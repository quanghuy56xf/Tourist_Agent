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
