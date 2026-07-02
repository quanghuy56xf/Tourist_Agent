const SESSION_KEY = "visitor_analytics_session";
const SEARCH_SESSION_KEY = "visitor_search_session_id";

export function getVisitorSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function createSearchSessionId(): string {
  const id = crypto.randomUUID();
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SEARCH_SESSION_KEY, id);
  }
  return id;
}

export function getActiveSearchSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SEARCH_SESSION_KEY);
}

export type VisitorEventType = "group_visit" | "item_view";

export type EvalEventType =
  | "story_scan_started"
  | "story_first_meaningful_audio"
  | "story_completed"
  | "eval_feedback"
  | "quest_started"
  | "quest_completed"
  | "quest_abandoned"
  | "quiz_pre_submitted"
  | "quiz_post_submitted";

async function postAnalyticsEvent(
  eventType: VisitorEventType | EvalEventType,
  payload: {
    groupId?: number;
    itemId?: number;
    searchSessionId?: string | null;
    durationMs?: number;
    success?: boolean;
    errorDetail?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const sessionId = getVisitorSessionId();
  if (!sessionId) return;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
  try {
    await fetch(`${API_URL}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          {
            event_type: eventType,
            group_id: payload.groupId ?? null,
            item_id: payload.itemId ?? null,
            session_id: sessionId,
            search_session_id: payload.searchSessionId ?? getActiveSearchSessionId(),
            duration_ms: payload.durationMs ?? null,
            success: payload.success ?? true,
            error_detail: payload.errorDetail ?? null,
            metadata: payload.metadata ?? null,
          },
        ],
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must not block visitor UX.
  }
}

export async function trackVisitorEvent(
  eventType: VisitorEventType,
  payload: {
    groupId?: number;
    itemId?: number;
    searchSessionId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  return postAnalyticsEvent(eventType, payload);
}

export async function trackEvalEvent(
  eventType: EvalEventType,
  payload: {
    groupId?: number;
    itemId?: number;
    searchSessionId?: string | null;
    durationMs?: number;
    success?: boolean;
    errorDetail?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  return postAnalyticsEvent(eventType, payload);
}

export interface SearchTrackingContext {
  sessionId: string;
  groupId?: number;
  searchSessionId: string;
}

export function buildSearchTrackingContext(groupId?: number): SearchTrackingContext {
  return {
    sessionId: getVisitorSessionId(),
    groupId,
    searchSessionId: createSearchSessionId(),
  };
}

export function readStoredGroupId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("visitor_group_id");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
