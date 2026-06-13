import hashlib
import logging
from dataclasses import dataclass
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.personas import (
    DEFAULT_LANGUAGE,
    DEFAULT_PERSONA,
    all_variants,
    normalize_language,
    normalize_persona,
)
from app.modules.content.text_utils import strip_citations
from app.modules.content.tts import synthesize_speech
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.service import build_item_context

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ItemContentResult:
    item_id: int
    persona: str
    language: str
    content: str
    has_audio: bool
    audio_url: str | None
    stored: bool
    source: str


def compute_content_hash(description: str, group_knowledge_version: int = 0) -> str:
    del group_knowledge_version
    return hashlib.sha256(description.encode("utf-8")).hexdigest()


def build_audio_url(item_id: int, persona: str, language: str) -> str:
    query = urlencode({"persona": persona, "language": language})
    return f"/api/objects/{item_id}/content/audio?{query}"


class ItemContentService:
    def get_valid_variant(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
    ) -> ItemContentVariant | None:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        expected_hash = compute_content_hash(item.description)
        variant = (
            db.query(ItemContentVariant)
            .filter(
                ItemContentVariant.item_id == item.id,
                ItemContentVariant.persona == persona,
                ItemContentVariant.language == language,
                ItemContentVariant.content_hash == expected_hash,
                ItemContentVariant.status == "ready",
            )
            .first()
        )
        return variant

    def upsert_variant(
        self,
        db: Session,
        *,
        item: Item,
        persona: str,
        language: str,
        text_content: str,
        audio_data: bytes | None,
        audio_mime: str | None,
        source: str,
        status: str = "ready",
    ) -> ItemContentVariant:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        content_hash = compute_content_hash(item.description)
        variant = (
            db.query(ItemContentVariant)
            .filter(
                ItemContentVariant.item_id == item.id,
                ItemContentVariant.persona == persona,
                ItemContentVariant.language == language,
            )
            .first()
        )
        if variant is None:
            variant = ItemContentVariant(
                item_id=item.id,
                persona=persona,
                language=language,
                text_content=text_content,
                audio_data=audio_data,
                audio_mime=audio_mime,
                source=source,
                status=status,
                content_hash=content_hash,
            )
            db.add(variant)
        else:
            variant.text_content = text_content
            variant.audio_data = audio_data
            variant.audio_mime = audio_mime
            variant.source = source
            variant.status = status
            variant.content_hash = content_hash
        db.commit()
        db.refresh(variant)
        return variant

    def delete_variants_for_item(self, db: Session, item_id: int) -> None:
        db.query(ItemContentVariant).filter(
            ItemContentVariant.item_id == item_id
        ).delete()
        db.commit()

    def generate_text(
        self,
        item: Item,
        persona: str,
        language: str,
    ) -> tuple[str, str]:
        docs = build_item_context(
            item_id=item.id,
            item_name=item.name,
            item_description=item.description,
            group_id=item.group_id,
            retriever=try_get_rag_retriever(),
            top_k=5,
        )
        query = f"Giới thiệu chi tiết về {item.name}."
        try:
            content = get_rag_generator().generate_answer(
                query=query,
                retrieved_docs=docs,
                persona=persona,
                language=language,
            )
            return strip_citations(content), "generated"
        except LLMServiceUnavailableError:
            raise
        except Exception:
            logger.exception("Story generation failed for item %s", item.id)
            return item.description, "fallback_description"

    def generate_and_persist(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
        *,
        source: str = "generated",
    ) -> ItemContentResult:
        persona = normalize_persona(persona)
        language = normalize_language(language)

        try:
            text_content, resolved_source = self.generate_text(item, persona, language)
            if source == "pregenerated" and resolved_source == "generated":
                resolved_source = "pregenerated"
        except LLMServiceUnavailableError:
            raise

        audio_result = synthesize_speech(strip_citations(text_content), language)
        audio_data = audio_result[0] if audio_result else None
        audio_mime = audio_result[1] if audio_result else None

        self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=text_content,
            audio_data=audio_data,
            audio_mime=audio_mime,
            source=resolved_source,
        )

        return self._to_result(item.id, persona, language, text_content, audio_data, False, resolved_source)

    def get_or_generate(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
    ) -> ItemContentResult:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        variant = self.get_valid_variant(db, item, persona, language)
        if variant is not None:
            return self._variant_to_result(item.id, variant, stored=True)

        if persona != DEFAULT_PERSONA or language != DEFAULT_LANGUAGE:
            base_variant = self.get_valid_variant(
                db,
                item,
                DEFAULT_PERSONA,
                DEFAULT_LANGUAGE,
            )
            if base_variant is not None and base_variant.text_content.strip():
                try:
                    return self.generate_adapted_variant(
                        db,
                        item,
                        persona,
                        language,
                        base_variant.text_content,
                    )
                except LLMServiceUnavailableError:
                    raise

        return self.generate_and_persist(
            db,
            item,
            persona,
            language,
            source="generated",
        )

    def generate_adapted_variant(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
        base_content: str,
    ) -> ItemContentResult:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        adapted = get_rag_generator().adapt_content(
            base_content,
            item.name,
            persona,
            language,
        )
        text_content = strip_citations(adapted)
        audio_result = synthesize_speech(text_content, language)
        audio_data = audio_result[0] if audio_result else None
        audio_mime = audio_result[1] if audio_result else None
        self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=text_content,
            audio_data=audio_data,
            audio_mime=audio_mime,
            source="generated",
        )
        return self._to_result(
            item.id,
            persona,
            language,
            text_content,
            audio_data,
            False,
            "generated",
        )

    def generate_draft_content(
        self,
        item: Item,
        persona: str,
        language: str,
    ) -> str:
        text_content, _ = self.generate_text(item, persona, language)
        return strip_citations(text_content)

    def regenerate_all_variants_from_rag(
        self,
        db: Session,
        item: Item,
    ) -> ItemContentResult:
        result = self.generate_and_persist(
            db,
            item,
            DEFAULT_PERSONA,
            DEFAULT_LANGUAGE,
            source="generated",
        )
        self.regenerate_other_variants(db, item, result.content)
        return result

    def update_content(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
        text_content: str,
    ) -> ItemContentResult:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        if persona != DEFAULT_PERSONA or language != DEFAULT_LANGUAGE:
            raise ValueError("read_only_variant")

        normalized = strip_citations(text_content.strip())
        if not normalized:
            raise ValueError("empty_content")

        audio_result = synthesize_speech(normalized, language)
        audio_data = audio_result[0] if audio_result else None
        audio_mime = audio_result[1] if audio_result else None

        self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=normalized,
            audio_data=audio_data,
            audio_mime=audio_mime,
            source="manual",
        )

        return self._to_result(
            item.id,
            persona,
            language,
            normalized,
            audio_data,
            True,
            "manual",
        )

    def regenerate_other_variants(
        self,
        db: Session,
        item: Item,
        base_content: str,
    ) -> None:
        base_content = strip_citations(base_content.strip())
        if not base_content:
            return

        generator = get_rag_generator()
        for persona, language in all_variants():
            if persona == DEFAULT_PERSONA and language == DEFAULT_LANGUAGE:
                continue
            try:
                self.generate_adapted_variant(
                    db,
                    item,
                    persona,
                    language,
                    base_content,
                )
            except Exception:
                logger.exception(
                    "Failed to regenerate variant for item %s (%s, %s)",
                    item.id,
                    persona,
                    language,
                )

    def _variant_to_result(
        self,
        item_id: int,
        variant: ItemContentVariant,
        *,
        stored: bool,
    ) -> ItemContentResult:
        return self._to_result(
            item_id,
            variant.persona,
            variant.language,
            variant.text_content,
            variant.audio_data,
            stored,
            variant.source,
        )

    def _to_result(
        self,
        item_id: int,
        persona: str,
        language: str,
        text_content: str,
        audio_data: bytes | None,
        stored: bool,
        source: str,
    ) -> ItemContentResult:
        has_audio = audio_data is not None
        return ItemContentResult(
            item_id=item_id,
            persona=persona,
            language=language,
            content=text_content,
            has_audio=has_audio,
            audio_url=build_audio_url(item_id, persona, language) if has_audio else None,
            stored=stored,
            source=source,
        )


_item_content_service: ItemContentService | None = None


def get_item_content_service() -> ItemContentService:
    global _item_content_service
    if _item_content_service is None:
        _item_content_service = ItemContentService()
    return _item_content_service
