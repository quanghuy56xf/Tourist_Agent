import csv
import io
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import (
    LLM_INPUT_CACHE_HIT_PRICE_PER_1M,
    LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
    LLM_MODEL,
    LLM_OUTPUT_PRICE_PER_1M,
)
from app.models.chat_turn_log import ChatTurnLog
from app.models.group import Group
from app.models.item import Item
from app.models.llm_pricing_config import LlmPricingConfig
from app.modules.llm.client import TokenUsage, estimate_token_usage
from app.schemas.analytics import (
    ChatConversationRow,
    ChatConversationsResponse,
    ChatCostDailyRow,
    ChatCostSummaryResponse,
    ChatLogListResponse,
    ChatTurnRow,
    LlmPricingConfigResponse,
    LlmPricingConfigUpdate,
)

logger = logging.getLogger(__name__)

MAX_MESSAGE_LENGTH = 4000


def resolve_conversation_id(
    *,
    session_id: str | None,
    search_session_id: str | None,
    item_id: int | None,
    chat_mode: str,
) -> str:
    if search_session_id:
        return search_session_id
    session_part = (session_id or "unknown").strip() or "unknown"
    if chat_mode == "companion":
        return f"{session_part}:companion"
    return f"{session_part}:item:{item_id or 0}"


def get_active_pricing(db: Session) -> LlmPricingConfig:
    row = db.query(LlmPricingConfig).order_by(LlmPricingConfig.id.asc()).first()
    if row is None:
        row = LlmPricingConfig(
            input_price_per_1m=LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
            input_cache_hit_price_per_1m=LLM_INPUT_CACHE_HIT_PRICE_PER_1M,
            input_cache_miss_price_per_1m=LLM_INPUT_CACHE_MISS_PRICE_PER_1M,
            output_price_per_1m=LLM_OUTPUT_PRICE_PER_1M,
            currency="USD",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    if row.input_cache_miss_price_per_1m <= 0 and row.input_price_per_1m > 0:
        row.input_cache_miss_price_per_1m = row.input_price_per_1m
    if row.input_cache_hit_price_per_1m <= 0:
        row.input_cache_hit_price_per_1m = LLM_INPUT_CACHE_HIT_PRICE_PER_1M
    return row


def compute_cost_usd(
    *,
    prompt_cache_hit_tokens: int,
    prompt_cache_miss_tokens: int,
    completion_tokens: int,
    input_cache_hit_price_per_1m: float,
    input_cache_miss_price_per_1m: float,
    output_price_per_1m: float,
) -> float:
    return round(
        (prompt_cache_hit_tokens / 1_000_000) * input_cache_hit_price_per_1m
        + (prompt_cache_miss_tokens / 1_000_000) * input_cache_miss_price_per_1m
        + (completion_tokens / 1_000_000) * output_price_per_1m,
        6,
    )


def _truncate(text: str | None, limit: int = MAX_MESSAGE_LENGTH) -> str | None:
    if text is None:
        return None
    cleaned = text.strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


def _next_turn_index(db: Session, conversation_id: str) -> int:
    current = (
        db.query(func.max(ChatTurnLog.turn_index))
        .filter(ChatTurnLog.conversation_id == conversation_id)
        .scalar()
    )
    return int(current or 0) + 1


def record_chat_turn(
    db: Session,
    *,
    conversation_id: str,
    chat_mode: str,
    user_message: str,
    assistant_message: str | None,
    group_id: int | None,
    item_id: int | None,
    session_id: str | None,
    search_session_id: str | None,
    persona: str | None,
    language: str | None,
    success: bool,
    error_detail: str | None,
    duration_ms: int | None,
    token_usage: TokenUsage | None,
    prompt_text_for_estimate: str = "",
) -> ChatTurnLog | None:
    try:
        pricing = get_active_pricing(db)
        if token_usage is None:
            token_usage = estimate_token_usage(
                prompt_text=prompt_text_for_estimate or user_message,
                completion_text=assistant_message or "",
            )

        cost_usd = compute_cost_usd(
            prompt_cache_hit_tokens=token_usage.prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=token_usage.prompt_cache_miss_tokens,
            completion_tokens=token_usage.completion_tokens,
            input_cache_hit_price_per_1m=pricing.input_cache_hit_price_per_1m,
            input_cache_miss_price_per_1m=pricing.input_cache_miss_price_per_1m,
            output_price_per_1m=pricing.output_price_per_1m,
        )
        turn_index = _next_turn_index(db, conversation_id)

        row = ChatTurnLog(
            conversation_id=conversation_id,
            turn_index=turn_index,
            chat_mode=chat_mode,
            group_id=group_id,
            item_id=item_id,
            session_id=session_id,
            search_session_id=search_session_id,
            user_message=_truncate(user_message) or "",
            assistant_message=_truncate(assistant_message),
            persona=persona,
            language=language,
            success=1 if success else 0,
            error_detail=error_detail[:500] if error_detail else None,
            duration_ms=duration_ms,
            prompt_tokens=token_usage.prompt_tokens,
            prompt_cache_hit_tokens=token_usage.prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=token_usage.prompt_cache_miss_tokens,
            completion_tokens=token_usage.completion_tokens,
            total_tokens=token_usage.total_tokens,
            token_source=token_usage.token_source,
            input_price_per_1m=pricing.input_cache_miss_price_per_1m,
            input_cache_hit_price_per_1m=pricing.input_cache_hit_price_per_1m,
            input_cache_miss_price_per_1m=pricing.input_cache_miss_price_per_1m,
            output_price_per_1m=pricing.output_price_per_1m,
            cost_usd=cost_usd,
            llm_model=LLM_MODEL,
        )
        db.add(row)
        db.flush()
        row.turn_code = f"CHAT-{row.id}"
        db.commit()
        db.refresh(row)
        return row
    except Exception:
        logger.exception("Failed to record chat turn log")
        db.rollback()
        return None


def _since(days: int) -> datetime:
    return datetime.utcnow() - timedelta(days=days)


def _parse_turn_code(value: str | None) -> int | None:
    if not value:
        return None
    cleaned = value.strip().upper()
    if cleaned.startswith("CHAT-"):
        cleaned = cleaned[5:]
    try:
        return int(cleaned)
    except ValueError:
        return None


def _base_turn_query(
    db: Session,
    *,
    since: datetime,
    allowed_group_ids: list[int] | None,
    group_id: int | None,
    item_id: int | None,
    conversation_id: str | None,
    turn_code: str | None,
    status: str,
):
    query = db.query(ChatTurnLog).filter(ChatTurnLog.created_at >= since)

    if allowed_group_ids is not None:
        if not allowed_group_ids:
            return query.filter(False)
        query = query.filter(ChatTurnLog.group_id.in_(allowed_group_ids))

    if group_id is not None:
        query = query.filter(ChatTurnLog.group_id == group_id)
    if item_id is not None:
        query = query.filter(ChatTurnLog.item_id == item_id)
    if conversation_id:
        query = query.filter(ChatTurnLog.conversation_id == conversation_id.strip())

    turn_id = _parse_turn_code(turn_code)
    if turn_id is not None:
        query = query.filter(ChatTurnLog.id == turn_id)

    if status == "success":
        query = query.filter(ChatTurnLog.success == 1)
    elif status == "error":
        query = query.filter(ChatTurnLog.success == 0)

    return query


def _group_name_map(db: Session, group_ids: set[int]) -> dict[int, str]:
    if not group_ids:
        return {}
    rows = db.query(Group.id, Group.name).filter(Group.id.in_(group_ids)).all()
    return {row.id: row.name for row in rows}


def _item_name_map(db: Session, item_ids: set[int]) -> dict[int, str]:
    if not item_ids:
        return {}
    rows = db.query(Item.id, Item.name).filter(Item.id.in_(item_ids)).all()
    return {row.id: row.name for row in rows}


def _to_turn_row(row: ChatTurnLog, group_names: dict[int, str], item_names: dict[int, str]) -> ChatTurnRow:
    return ChatTurnRow(
        id=row.id,
        turn_code=row.turn_code or f"CHAT-{row.id}",
        conversation_id=row.conversation_id,
        turn_index=row.turn_index,
        chat_mode=row.chat_mode,
        group_id=row.group_id,
        group_name=group_names.get(row.group_id) if row.group_id else None,
        item_id=row.item_id,
        item_name=item_names.get(row.item_id) if row.item_id else None,
        user_message=row.user_message,
        assistant_message=row.assistant_message,
        persona=row.persona,
        language=row.language,
        success=bool(row.success),
        error_detail=row.error_detail,
        duration_ms=row.duration_ms,
        prompt_tokens=row.prompt_tokens,
        prompt_cache_hit_tokens=row.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens=row.prompt_cache_miss_tokens,
        completion_tokens=row.completion_tokens,
        total_tokens=row.total_tokens,
        token_source=row.token_source,
        input_price_per_1m=row.input_cache_miss_price_per_1m or row.input_price_per_1m,
        input_cache_hit_price_per_1m=row.input_cache_hit_price_per_1m,
        input_cache_miss_price_per_1m=row.input_cache_miss_price_per_1m or row.input_price_per_1m,
        output_price_per_1m=row.output_price_per_1m,
        cost_usd=row.cost_usd,
        llm_model=row.llm_model,
        created_at=row.created_at.isoformat(),
    )


def query_chat_logs(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    conversation_id: str | None = None,
    turn_code: str | None = None,
    status: str = "all",
    page: int = 1,
    limit: int = 50,
) -> ChatLogListResponse:
    since = _since(days)
    query = _base_turn_query(
        db,
        since=since,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=turn_code,
        status=status,
    )
    total = query.count()
    offset = max(0, (page - 1) * limit)
    rows = (
        query.order_by(ChatTurnLog.created_at.desc(), ChatTurnLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    group_ids = {row.group_id for row in rows if row.group_id is not None}
    item_ids = {row.item_id for row in rows if row.item_id is not None}
    group_names = _group_name_map(db, group_ids)
    item_names = _item_name_map(db, item_ids)

    totals = query.with_entities(
        func.coalesce(func.sum(ChatTurnLog.prompt_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.completion_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.total_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.cost_usd), 0.0),
    ).one()

    return ChatLogListResponse(
        range_days=days,
        page=page,
        limit=limit,
        total=total,
        total_prompt_tokens=int(totals[0] or 0),
        total_completion_tokens=int(totals[1] or 0),
        total_tokens=int(totals[2] or 0),
        total_cost_usd=round(float(totals[3] or 0.0), 6),
        items=[_to_turn_row(row, group_names, item_names) for row in rows],
    )


def _conversation_question_counts(
    db: Session,
    conversation_ids: list[str],
) -> dict[str, int]:
    if not conversation_ids:
        return {}
    rows = (
        db.query(ChatTurnLog.conversation_id, func.count(ChatTurnLog.id))
        .filter(ChatTurnLog.conversation_id.in_(conversation_ids))
        .group_by(ChatTurnLog.conversation_id)
        .all()
    )
    return {conversation_id: int(count) for conversation_id, count in rows}


def query_chat_conversations(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    conversation_id: str | None = None,
    status: str = "all",
    min_questions: int | None = None,
    max_questions: int | None = None,
    page: int = 1,
    limit: int = 50,
) -> ChatConversationsResponse:
    since = _since(days)
    query = _base_turn_query(
        db,
        since=since,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=None,
        status=status,
    )
    rows = query.order_by(ChatTurnLog.created_at.asc(), ChatTurnLog.id.asc()).all()

    grouped: dict[str, list[ChatTurnLog]] = defaultdict(list)
    for row in rows:
        grouped[row.conversation_id].append(row)

    conversation_rows: list[ChatConversationRow] = []
    group_ids: set[int] = set()
    item_ids: set[int] = set()

    for conv_id, turns in grouped.items():
        question_count = len(turns)
        if min_questions is not None and question_count < min_questions:
            continue
        if max_questions is not None and question_count > max_questions:
            continue

        first = turns[0]
        last = turns[-1]
        if first.group_id is not None:
            group_ids.add(first.group_id)
        if first.item_id is not None:
            item_ids.add(first.item_id)

        conversation_rows.append(
            ChatConversationRow(
                conversation_id=conv_id,
                question_count=question_count,
                chat_mode=first.chat_mode,
                group_id=first.group_id,
                item_id=first.item_id,
                total_prompt_tokens=sum(turn.prompt_tokens for turn in turns),
                total_completion_tokens=sum(turn.completion_tokens for turn in turns),
                total_tokens=sum(turn.total_tokens for turn in turns),
                total_cost_usd=round(sum(turn.cost_usd for turn in turns), 6),
                success_count=sum(1 for turn in turns if turn.success),
                error_count=sum(1 for turn in turns if not turn.success),
                first_at=first.created_at.isoformat(),
                last_at=last.created_at.isoformat(),
            )
        )

    conversation_rows.sort(key=lambda row: row.last_at, reverse=True)
    total = len(conversation_rows)
    offset = max(0, (page - 1) * limit)
    page_rows = conversation_rows[offset : offset + limit]

    group_names = _group_name_map(db, group_ids)
    item_names = _item_name_map(db, item_ids)
    for row in page_rows:
        row.group_name = group_names.get(row.group_id) if row.group_id else None
        row.item_name = item_names.get(row.item_id) if row.item_id else None

    return ChatConversationsResponse(
        range_days=days,
        page=page,
        limit=limit,
        total=total,
        total_prompt_tokens=sum(row.total_prompt_tokens for row in conversation_rows),
        total_completion_tokens=sum(row.total_completion_tokens for row in conversation_rows),
        total_tokens=sum(row.total_tokens for row in conversation_rows),
        total_cost_usd=round(sum(row.total_cost_usd for row in conversation_rows), 6),
        items=page_rows,
    )


def build_cost_summary(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    status: str = "all",
) -> ChatCostSummaryResponse:
    since = _since(days)
    query = _base_turn_query(
        db,
        since=since,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=None,
        turn_code=None,
        status=status,
    )

    daily_rows = (
        query.with_entities(
            func.date(ChatTurnLog.created_at).label("day"),
            func.count(ChatTurnLog.id).label("turn_count"),
            func.coalesce(func.sum(ChatTurnLog.prompt_tokens), 0),
            func.coalesce(func.sum(ChatTurnLog.completion_tokens), 0),
            func.coalesce(func.sum(ChatTurnLog.total_tokens), 0),
            func.coalesce(func.sum(ChatTurnLog.cost_usd), 0.0),
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    totals = query.with_entities(
        func.count(ChatTurnLog.id),
        func.coalesce(func.sum(ChatTurnLog.prompt_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.completion_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.total_tokens), 0),
        func.coalesce(func.sum(ChatTurnLog.cost_usd), 0.0),
    ).one()

    return ChatCostSummaryResponse(
        range_days=days,
        total_turns=int(totals[0] or 0),
        total_prompt_tokens=int(totals[1] or 0),
        total_completion_tokens=int(totals[2] or 0),
        total_tokens=int(totals[3] or 0),
        total_cost_usd=round(float(totals[4] or 0.0), 6),
        daily=[
            ChatCostDailyRow(
                date=str(day),
                turn_count=int(turn_count or 0),
                prompt_tokens=int(prompt_tokens or 0),
                completion_tokens=int(completion_tokens or 0),
                total_tokens=int(total_tokens or 0),
                cost_usd=round(float(cost_usd or 0.0), 6),
            )
            for day, turn_count, prompt_tokens, completion_tokens, total_tokens, cost_usd in daily_rows
        ],
    )


def get_pricing_config(db: Session) -> LlmPricingConfigResponse:
    row = get_active_pricing(db)
    miss_price = row.input_cache_miss_price_per_1m or row.input_price_per_1m
    return LlmPricingConfigResponse(
        input_price_per_1m=miss_price,
        input_cache_hit_price_per_1m=row.input_cache_hit_price_per_1m,
        input_cache_miss_price_per_1m=miss_price,
        output_price_per_1m=row.output_price_per_1m,
        currency=row.currency,
        updated_at=row.updated_at.isoformat(),
        updated_by=row.updated_by,
    )


def update_pricing_config(
    db: Session,
    payload: LlmPricingConfigUpdate,
    *,
    updated_by: str | None = None,
) -> LlmPricingConfigResponse:
    row = get_active_pricing(db)
    row.input_cache_hit_price_per_1m = payload.input_cache_hit_price_per_1m
    row.input_cache_miss_price_per_1m = payload.input_cache_miss_price_per_1m
    row.input_price_per_1m = payload.input_cache_miss_price_per_1m
    row.output_price_per_1m = payload.output_price_per_1m
    row.currency = payload.currency or row.currency
    row.updated_by = updated_by
    db.commit()
    db.refresh(row)
    return get_pricing_config(db)


def _chat_log_filters_to_dict(**kwargs) -> dict:
    return {key: value for key, value in kwargs.items() if value is not None}


def export_chat_logs_csv(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    conversation_id: str | None = None,
    turn_code: str | None = None,
    status: str = "all",
) -> str:
    since = _since(days)
    query = _base_turn_query(
        db,
        since=since,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=turn_code,
        status=status,
    )
    rows = query.order_by(ChatTurnLog.created_at.desc(), ChatTurnLog.id.desc()).all()
    group_ids = {row.group_id for row in rows if row.group_id is not None}
    item_ids = {row.item_id for row in rows if row.item_id is not None}
    group_names = _group_name_map(db, group_ids)
    item_names = _item_name_map(db, item_ids)

    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "turn_code",
            "conversation_id",
            "turn_index",
            "chat_mode",
            "created_at",
            "group_name",
            "item_name",
            "user_message",
            "assistant_message",
            "prompt_tokens",
            "prompt_cache_hit_tokens",
            "prompt_cache_miss_tokens",
            "completion_tokens",
            "total_tokens",
            "cost_usd",
            "input_cache_hit_price_per_1m",
            "input_cache_miss_price_per_1m",
            "output_price_per_1m",
            "token_source",
            "success",
            "error_detail",
            "duration_ms",
            "persona",
            "language",
            "llm_model",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.turn_code,
                row.conversation_id,
                row.turn_index,
                row.chat_mode,
                row.created_at.isoformat(),
                group_names.get(row.group_id, "") if row.group_id else "",
                item_names.get(row.item_id, "") if row.item_id else "",
                row.user_message,
                row.assistant_message or "",
                row.prompt_tokens,
                row.prompt_cache_hit_tokens,
                row.prompt_cache_miss_tokens,
                row.completion_tokens,
                row.total_tokens,
                row.cost_usd,
                row.input_cache_hit_price_per_1m,
                row.input_cache_miss_price_per_1m or row.input_price_per_1m,
                row.output_price_per_1m,
                row.token_source,
                "success" if row.success else "error",
                row.error_detail or "",
                row.duration_ms or "",
                row.persona or "",
                row.language or "",
                row.llm_model or "",
            ]
        )
    return buffer.getvalue()


def export_chat_conversations_csv(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    conversation_id: str | None = None,
    status: str = "all",
    min_questions: int | None = None,
    max_questions: int | None = None,
) -> str:
    result = query_chat_conversations(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        status=status,
        min_questions=min_questions,
        max_questions=max_questions,
        page=1,
        limit=100_000,
    )

    buffer = io.StringIO()
    buffer.write("\ufeff")
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "conversation_id",
            "question_count",
            "chat_mode",
            "group_name",
            "item_name",
            "first_at",
            "last_at",
            "total_prompt_tokens",
            "total_completion_tokens",
            "total_tokens",
            "total_cost_usd",
            "success_count",
            "error_count",
        ]
    )
    for row in result.items:
        writer.writerow(
            [
                row.conversation_id,
                row.question_count,
                row.chat_mode,
                row.group_name or "",
                row.item_name or "",
                row.first_at,
                row.last_at,
                row.total_prompt_tokens,
                row.total_completion_tokens,
                row.total_tokens,
                row.total_cost_usd,
                row.success_count,
                row.error_count,
            ]
        )
    return buffer.getvalue()


def export_chat_logs_json(
    db: Session,
    *,
    days: int,
    allowed_group_ids: list[int] | None,
    group_id: int | None = None,
    item_id: int | None = None,
    conversation_id: str | None = None,
    turn_code: str | None = None,
    status: str = "all",
) -> str:
    result = query_chat_logs(
        db,
        days=days,
        allowed_group_ids=allowed_group_ids,
        group_id=group_id,
        item_id=item_id,
        conversation_id=conversation_id,
        turn_code=turn_code,
        status=status,
        page=1,
        limit=100_000,
    )
    return json.dumps(result.model_dump(), ensure_ascii=False, indent=2)
