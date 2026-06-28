import type { SearchTrackingContext } from "@/lib/visitorAnalytics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const NGROK_HEADERS: HeadersInit = API_URL.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "true" }
  : {};

export interface SearchImage {
  angle: string;
  url: string;
}

export interface SearchMatch {
  item_id: number;
  name: string;
  description: string;
  similarity: number;
  image_url: string | null;
  images?: SearchImage[];
}

export interface SearchResponse {
  found: boolean;
  results: SearchMatch[];
  message?: string;
}

export async function searchObject(
  image: Blob,
  tracking?: SearchTrackingContext
): Promise<SearchResponse> {
  const formData = new FormData();
  formData.append("search_image", image, "search.jpg");
  if (tracking?.sessionId) formData.append("session_id", tracking.sessionId);
  if (tracking?.groupId != null) formData.append("group_id", String(tracking.groupId));
  if (tracking?.searchSessionId) {
    formData.append("search_session_id", tracking.searchSessionId);
  }

  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    body: formData,
    headers: NGROK_HEADERS,
  });

  if (!res.ok) {
    throw new Error("Search failed");
  }

  return res.json();
}
