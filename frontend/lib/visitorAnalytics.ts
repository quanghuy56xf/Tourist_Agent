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

export async function trackVisitorEvent(
  eventType: "group_visit" | "item_view",
  payload: {
    groupId?: number;
    itemId?: number;
    searchSessionId?: string | null;
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
