import hashlib
import logging
from dataclasses import dataclass
from urllib.parse import urlencode

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.content_variant import ItemContentVariant
from app.models.item import Item
from app.modules.content.personas import (
    DEFAULT_LANGUAGE,
    DEFAULT_PERSONA,
    all_variants,
    normalize_language,
    normalize_persona,
)
from app.modules.content.text_utils import (
    GENERATION_RULES_VERSION,
    is_no_information_content,
    polish_generated_text,
    resolve_propagated_variant_content,
    strip_citations,
)
from app.modules.content.audio_backoff import (
    clear_audio_backoff,
    record_audio_failure,
)
from app.modules.content.tts import build_audio_mime, is_current_audio_mime, synthesize_speech
from app.modules.content.content_analytics import (
    CONTENT_EVENT_AUDIO_ERROR,
    CONTENT_EVENT_NO_INFORMATION,
    CONTENT_EVENT_TEXT_ERROR,
    record_content_issue,
    should_record_audio_error,
)
from app.modules.llm.client import LLMServiceUnavailableError
from app.modules.llm.generator import get_rag_generator
from app.modules.rag.retriever import try_get_rag_retriever
from app.modules.rag.service import (
    build_item_retrieval_query,
    build_verified_item_context,
    is_substantive_item_description,
    no_item_knowledge_message,
)

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
    audio_status: str = "pending"


def compute_content_hash(
    description: str,
    group_knowledge_version: int | str = 0,
    source: str = "generated",
) -> str:
    if isinstance(group_knowledge_version, str):
        source = group_knowledge_version
        group_knowledge_version = 0
    hash_input = description
    if source != "manual":
        hash_input = (
            f"{GENERATION_RULES_VERSION}:{group_knowledge_version}:{description}"
        )
    return hashlib.sha256(hash_input.encode("utf-8")).hexdigest()


def compute_text_version(text_content: str) -> str:
    return hashlib.sha256(text_content.encode("utf-8")).hexdigest()[:16]


def build_audio_url(
    item_id: int,
    persona: str,
    language: str,
    text_content: str,
) -> str:
    query = urlencode(
        {
            "persona": persona,
            "language": language,
            "v": compute_text_version(text_content),
        }
    )
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
        variant = (
            db.query(ItemContentVariant)
            .filter(
                ItemContentVariant.item_id == item.id,
                ItemContentVariant.persona == persona,
                ItemContentVariant.language == language,
                ItemContentVariant.status == "ready",
            )
            .first()
        )
        if variant is None:
            return None
        group_knowledge_version = item.group.knowledge_version if item.group else 0
        expected_hash = compute_content_hash(item.description, group_knowledge_version=group_knowledge_version, source=variant.source)
        if variant.content_hash != expected_hash:
            return None
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
        group_knowledge_version = item.group.knowledge_version if item.group else 0
        content_hash = compute_content_hash(item.description, group_knowledge_version=group_knowledge_version, source=source)

        def _load_variant() -> ItemContentVariant | None:
            return (
                db.query(ItemContentVariant)
                .filter(
                    ItemContentVariant.item_id == item.id,
                    ItemContentVariant.persona == persona,
                    ItemContentVariant.language == language,
                )
                .first()
            )

        def _apply_fields(variant: ItemContentVariant) -> ItemContentVariant:
            variant.text_content = text_content
            variant.audio_data = audio_data
            variant.audio_mime = audio_mime
            variant.source = source
            variant.status = status
            variant.content_hash = content_hash
            return variant

        variant = _load_variant()
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
            _apply_fields(variant)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            variant = _load_variant()
            if variant is None:
                raise
            _apply_fields(variant)
            db.commit()

        db.refresh(variant)
        return variant

    def delete_variants_for_item(
        self,
        db: Session,
        item_id: int,
        *,
        commit: bool = True,
    ) -> None:
        db.query(ItemContentVariant).filter(
            ItemContentVariant.item_id == item_id
        ).delete(synchronize_session=False)
        if commit:
            db.commit()

    def delete_variants_for_items(
        self,
        db: Session,
        item_ids: list[int],
        *,
        commit: bool = True,
    ) -> None:
        if not item_ids:
            return
        db.query(ItemContentVariant).filter(
            ItemContentVariant.item_id.in_(item_ids)
        ).delete(synchronize_session=False)
        if commit:
            db.commit()

    def delete_all_variants(self, db: Session, *, commit: bool = True) -> None:
        db.query(ItemContentVariant).delete(synchronize_session=False)
        if commit:
            db.commit()

    def generate_text(
        self,
        item: Item,
        persona: str,
        language: str,
    ) -> tuple[str, str]:
        docs, has_verified = build_verified_item_context(
            item_id=item.id,
            item_name=item.name,
            item_description=item.description,
            group_id=item.group_id,
            retriever=try_get_rag_retriever(),
            top_k=5,
        )
        if not has_verified:
            return no_item_knowledge_message(language), "no_knowledge"

        query = build_item_retrieval_query(item.name, item.description or "")
        try:
            content = get_rag_generator().generate_answer(
                query=query,
                retrieved_docs=docs,
                persona=persona,
                language=language,
            )
            content = polish_generated_text(content)
            if (
                is_substantive_item_description(item.description or "", item.name)
                and is_no_information_content(content)
            ):
                if persona == DEFAULT_PERSONA and language == DEFAULT_LANGUAGE:
                    content = item.description or ""
                else:
                    content = polish_generated_text(
                        get_rag_generator().adapt_content(
                            item.description or "",
                            item.name,
                            persona,
                            language,
                        )
                    )
            return content, "generated"
        except LLMServiceUnavailableError:
            raise
        except Exception:
            logger.exception("Story generation failed for item %s", item.id)
            return self._fallback_generated_text(item, persona, language)

    def _fallback_generated_text(
        self,
        item: Item,
        persona: str,
        language: str,
    ) -> tuple[str, str]:
        language = normalize_language(language)
        if language == DEFAULT_LANGUAGE:
            return item.description or "", "fallback_description"

        base = (item.description or "").strip()
        if not base:
            return no_item_knowledge_message(language), "no_knowledge"

        try:
            adapted = get_rag_generator().adapt_content(
                base,
                item.name,
                persona,
                language,
            )
            return polish_generated_text(adapted), "generated"
        except LLMServiceUnavailableError:
            raise
        except Exception:
            logger.exception(
                "Adaptation fallback failed for item %s (%s)", item.id, language
            )
            raise LLMServiceUnavailableError("Content generation unavailable")

    def _foreign_variant_is_stale(
        self,
        item: Item,
        variant: ItemContentVariant,
        base_variant: ItemContentVariant | None,
    ) -> bool:
        text = variant.text_content.strip()
        if not text:
            return True
        if variant.source == "fallback_description":
            return True
        description = (item.description or "").strip()
        if description and text == description:
            return True
        if (
            base_variant is not None
            and text == base_variant.text_content.strip()
        ):
            return True
        return False

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

        variant = self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=text_content,
            audio_data=None,
            audio_mime=None,
            source=resolved_source,
        )

        if (
            is_no_information_content(text_content)
            and persona == DEFAULT_PERSONA
            and language == DEFAULT_LANGUAGE
        ):
            record_content_issue(
                event_type=CONTENT_EVENT_NO_INFORMATION,
                item_id=item.id,
                group_id=item.group_id,
                persona=persona,
                language=language,
                error_detail=text_content[:500],
                item_name=item.name,
            )

        return self._variant_to_result(item.id, variant, stored=False)

    def get_or_generate(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
    ) -> ItemContentResult:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        base_variant = (
            self.get_valid_variant(db, item, DEFAULT_PERSONA, DEFAULT_LANGUAGE)
            if language != DEFAULT_LANGUAGE
            else None
        )

        variant = self.get_valid_variant(db, item, persona, language)
        if variant is not None:
            if language != DEFAULT_LANGUAGE and self._foreign_variant_is_stale(
                item, variant, base_variant
            ):
                variant = None
            else:
                return self._variant_to_result(item.id, variant, stored=True)

        if persona != DEFAULT_PERSONA and language == DEFAULT_LANGUAGE:
            if base_variant is None:
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

        if (
            language != DEFAULT_LANGUAGE
            and base_variant is not None
            and base_variant.text_content.strip()
        ):
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

    def finalize_with_audio(
        self,
        db: Session,
        item: Item,
        result: ItemContentResult,
    ) -> ItemContentResult:
        if not result.content.strip():
            return result
        variant = self.ensure_audio(db, item, result.persona, result.language)
        if variant is None:
            return ItemContentResult(
                item_id=result.item_id,
                persona=result.persona,
                language=result.language,
                content=result.content,
                has_audio=False,
                audio_url=None,
                audio_status="failed",
                stored=result.stored,
                source=result.source,
            )
        return self._variant_to_result(item.id, variant, stored=result.stored)

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
        if is_no_information_content(base_content):
            text_content, resolved_source = resolve_propagated_variant_content(
                base_content,
                language,
                no_knowledge_message_for_language=no_item_knowledge_message,
            )
            variant = self.upsert_variant(
                db,
                item=item,
                persona=persona,
                language=language,
                text_content=text_content,
                audio_data=None,
                audio_mime=None,
                source=resolved_source,
            )
            return self._variant_to_result(item.id, variant, stored=False)

        try:
            adapted = get_rag_generator().adapt_content(
                base_content,
                item.name,
                persona,
                language,
            )
        except Exception as exc:
            record_content_issue(
                event_type=CONTENT_EVENT_TEXT_ERROR,
                item_id=item.id,
                group_id=item.group_id,
                persona=persona,
                language=language,
                error_detail=str(exc)[:500],
                item_name=item.name,
            )
            raise

        text_content = polish_generated_text(adapted)
        variant = self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=text_content,
            audio_data=None,
            audio_mime=None,
            source="generated",
        )
        return self._variant_to_result(item.id, variant, stored=False)

    def ensure_audio(
        self,
        db: Session,
        item: Item,
        persona: str,
        language: str,
    ) -> ItemContentVariant | None:
        persona = normalize_persona(persona)
        language = normalize_language(language)
        variant = self.get_valid_variant(db, item, persona, language)
        if variant is None or not variant.text_content.strip():
            return None
        if is_no_information_content(variant.text_content):
            return variant
        if (
            variant.audio_data is not None
            and variant.audio_mime is not None
            and is_current_audio_mime(variant.audio_mime, persona=persona)
        ):
            return variant

        tts_result = synthesize_speech(variant.text_content, language, persona=persona)
        if not tts_result.ok or not tts_result.audio:
            target = (item.id, persona, language)
            record_audio_failure(target)
            if should_record_audio_error(
                db,
                item.id,
                persona,
                language,
                variant.updated_at,
            ):
                record_content_issue(
                    event_type=CONTENT_EVENT_AUDIO_ERROR,
                    item_id=item.id,
                    group_id=item.group_id,
                    persona=persona,
                    language=language,
                    error_detail=tts_result.error_detail or "Text-to-speech synthesis failed",
                    item_name=item.name,
                )
            return variant

        clear_audio_backoff((item.id, persona, language))
        return self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=variant.text_content,
            audio_data=tts_result.audio,
            audio_mime=build_audio_mime(persona=persona),
            source=variant.source,
        )

    def generate_draft_content(
        self,
        item: Item,
        persona: str,
        language: str,
    ) -> str:
        text_content, _ = self.generate_text(item, persona, language)
        return polish_generated_text(text_content)

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

        variant = self.upsert_variant(
            db,
            item=item,
            persona=persona,
            language=language,
            text_content=normalized,
            audio_data=None,
            audio_mime=None,
            source="manual",
        )

        return self._variant_to_result(item.id, variant, stored=True)

    def regenerate_other_variants(
        self,
        db: Session,
        item: Item,
        base_content: str,
    ) -> None:
        base_content = strip_citations(base_content.strip())
        if not base_content:
            return

        if is_no_information_content(base_content):
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
                        "Failed to propagate no-info variant for item %s (%s, %s)",
                        item.id,
                        persona,
                        language,
                    )
            return

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
            audio_url=(
                build_audio_url(item_id, persona, language, text_content)
                if has_audio and text_content.strip()
                else None
            ),
            audio_status="ready" if has_audio else "pending",
            stored=stored,
            source=source,
        )


_item_content_service: ItemContentService | None = None


def get_item_content_service() -> ItemContentService:
    global _item_content_service
    if _item_content_service is None:
        _item_content_service = ItemContentService()
    return _item_content_service
