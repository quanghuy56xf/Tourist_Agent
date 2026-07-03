from pydantic import BaseModel, Field


class AnalyticsEventIn(BaseModel):
    event_type: str = Field(min_length=1, max_length=64)
    group_id: int | None = None
    item_id: int | None = None
    session_id: str = Field(min_length=1, max_length=64)
    search_session_id: str | None = Field(default=None, max_length=64)
    duration_ms: int | None = Field(default=None, ge=0)
    success: bool = True
    error_detail: str | None = Field(default=None, max_length=500)
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


class RagConfidenceBucket(BaseModel):
    label: str
    min_score: float
    max_score: float
    count: int


class RagTraceRow(BaseModel):
    id: int
    chat_turn_id: int | None
    conversation_id: str
    group_id: int | None
    group_name: str | None = None
    item_id: int | None
    item_name: str | None = None
    query: str
    retrieval_query: str
    confidence_score: float
    dense_max_score: float
    fallback_used: bool
    fallback_reason: str | None
    has_verified_knowledge: bool
    retrieved_count: int
    reranked_count: int
    context_count: int
    latency_ms: int | None
    created_at: str


class RagIndexHealthGroupRow(BaseModel):
    group_id: int
    group_name: str
    document_count: int
    healthy: bool
    unhealthy_document_count: int
    missing_chunk_count: int
    stale_chunk_count: int
    surplus_chunk_count: int
    orphan_chunk_count: int


class RagEvalReportResponse(BaseModel):
    range_days: int
    total_traces: int
    avg_confidence_score: float
    avg_dense_max_score: float
    low_confidence_count: int
    low_confidence_rate: float
    fallback_count: int
    fallback_rate: float
    verified_knowledge_count: int
    verified_knowledge_rate: float
    avg_latency_ms: float
    confidence_buckets: list[RagConfidenceBucket]
    index_health: list[RagIndexHealthGroupRow]
    recent_traces: list[RagTraceRow]


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


class SttCostDailyRow(BaseModel):
    date: str
    request_count: int
    success_count: int
    error_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float


class SttSessionCostRow(BaseModel):
    session_id: str | None
    group_id: int | None
    group_name: str | None = None
    request_count: int
    success_count: int
    error_count: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    first_at: str
    last_at: str


class SttCostSummaryResponse(BaseModel):
    range_days: int
    total_requests: int
    success_count: int
    error_count: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_cost_usd: float
    daily: list[SttCostDailyRow]
    sessions: list[SttSessionCostRow]


class ProductEvalReportSource(BaseModel):
    path: str
    exists: bool


class ProductEvalFeedbackRow(BaseModel):
    created_at: str
    session_id: str | None
    group_name: str | None = None
    item_name: str | None = None
    persona_score: float | None = None
    storytelling_score: float | None = None
    voice_naturalness_score: float | None = None
    replay_intent_score: float | None = None
    comment: str | None = None


class ProductEvalReportResponse(BaseModel):
    range_days: int
    top1_image_accuracy: float | None = None
    trustworthy_answer_rate: float | None = None
    time_to_first_story_avg_ms: int | None = None
    time_to_first_story_p95_ms: int | None = None
    persona_storytelling_score: float | None = None
    voice_mos: float | None = None
    quest_started_count: int = 0
    quest_completed_count: int = 0
    quest_completion_rate: float | None = None
    learning_gain_avg: float | None = None
    normalized_learning_gain_avg: float | None = None
    replay_intent_score: float | None = None
    avg_artifacts_per_session: float | None = None
    p95_search_latency_ms: int | None = None
    p95_chat_latency_ms: int | None = None
    p95_e2e_latency_ms: int | None = None
    feedback_count: int = 0
    session_count: int = 0
    report_sources: list[ProductEvalReportSource] = Field(default_factory=list)
    recent_feedback: list[ProductEvalFeedbackRow] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
