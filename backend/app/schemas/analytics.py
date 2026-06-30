from pydantic import BaseModel, Field


class AnalyticsEventIn(BaseModel):
    event_type: str = Field(min_length=1, max_length=64)
    group_id: int | None = None
    item_id: int | None = None
    session_id: str = Field(min_length=1, max_length=64)
    search_session_id: str | None = Field(default=None, max_length=64)
    metadata: dict | None = None


class AnalyticsEventsRequest(BaseModel):
    events: list[AnalyticsEventIn] = Field(min_length=1, max_length=20)


class DailyCount(BaseModel):
    date: str
    count: int


class GroupActivityStats(BaseModel):
    group_id: int
    group_name: str
    visits: int
    searches: int
    visit_trend: list[DailyCount]
    search_trend: list[DailyCount]


class ChatPerSearchStats(BaseModel):
    avg_questions: float
    sessions_with_search: int
    distribution: list[dict[str, int]]


class SessionDurationStats(BaseModel):
    group_id: int
    group_name: str
    client_ip: str
    session_id: str
    duration_seconds: int
    event_count: int
    last_seen: str


class TimingStats(BaseModel):
    count: int
    avg_ms: float
    slow_count: int
    error_count: int


class SlowEventRow(BaseModel):
    event_type: str
    duration_ms: int | None
    group_name: str | None
    item_name: str | None
    client_ip: str | None
    error_detail: str | None
    created_at: str


class ContentIssueRow(BaseModel):
    event_type: str
    group_name: str | None
    item_name: str | None
    persona: str | None
    language: str | None
    error_detail: str | None
    created_at: str


class AnalyticsSummaryResponse(BaseModel):
    range_days: int
    total_visits: int
    total_searches: int
    groups: list[GroupActivityStats]
    chat_per_search: ChatPerSearchStats
    session_durations: list[SessionDurationStats]
    search_timing: TimingStats
    chat_timing: TimingStats
    slow_events: list[SlowEventRow]
    recent_errors: list[SlowEventRow]
    content_no_information_count: int = 0
    content_text_error_count: int = 0
    content_audio_error_count: int = 0
    content_issues: list[ContentIssueRow] = []


class LlmPricingConfigResponse(BaseModel):
    input_price_per_1m: float
    input_cache_hit_price_per_1m: float
    input_cache_miss_price_per_1m: float
    output_price_per_1m: float
    currency: str = "USD"
    updated_at: str
    updated_by: str | None = None


class LlmPricingConfigUpdate(BaseModel):
    input_cache_hit_price_per_1m: float = Field(ge=0)
    input_cache_miss_price_per_1m: float = Field(ge=0)
    output_price_per_1m: float = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=8)


class ChatTurnRow(BaseModel):
    id: int
    turn_code: str
    conversation_id: str
    turn_index: int
    chat_mode: str
    group_id: int | None
    group_name: str | None = None
    item_id: int | None
    item_name: str | None = None
    user_message: str
    assistant_message: str | None
    persona: str | None
    language: str | None
    success: bool
    error_detail: str | None
    duration_ms: int | None
    prompt_tokens: int
    prompt_cache_hit_tokens: int
    prompt_cache_miss_tokens: int
    completion_tokens: int
    total_tokens: int
    token_source: str
    input_price_per_1m: float
    input_cache_hit_price_per_1m: float
    input_cache_miss_price_per_1m: float
    output_price_per_1m: float
    cost_usd: float
    llm_model: str | None
    created_at: str


class ChatLogListResponse(BaseModel):
    range_days: int
    page: int
    limit: int
    total: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    items: list[ChatTurnRow]


class ChatConversationRow(BaseModel):
    conversation_id: str
    question_count: int
    chat_mode: str
    group_id: int | None
    group_name: str | None = None
    item_id: int | None
    item_name: str | None = None
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    success_count: int
    error_count: int
    first_at: str
    last_at: str


class ChatConversationsResponse(BaseModel):
    range_days: int
    page: int
    limit: int
    total: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    items: list[ChatConversationRow]


class ChatCostDailyRow(BaseModel):
    date: str
    turn_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float


class ChatCostSummaryResponse(BaseModel):
    range_days: int
    total_turns: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    daily: list[ChatCostDailyRow]
