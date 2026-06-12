// De trong = dung Next.js rewrite (hoat dong qua ngrok frontend)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const NGROK_HEADERS: HeadersInit = API_URL.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "true" }
  : {};

export interface RegisterResponse {
  item_id: number;
  message: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  item_count: number;
  created_at: string;
}

export interface ItemImage {
  angle: string;
  url: string;
}

export interface GroupItem {
  id: number;
  name: string;
  description: string;
  main_image_url: string | null;
  group_id?: number | null;
  images: ItemImage[];
  created_at: string;
}

export interface UngroupedItemsResponse {
  items: GroupItem[];
}

export interface GroupItemsResponse {
  group_id: number;
  group_name: string;
  items: GroupItem[];
}

export interface SearchMatch {
  item_id: number;
  name: string;
  description: string;
  similarity: number;
  image_url: string | null;
}

export interface SearchResponse {
  found: boolean;
  results: SearchMatch[];
  message?: string;
}

export async function registerObject(
  formData: FormData
): Promise<RegisterResponse> {
  const res = await fetch(`${API_URL}/api/objects/register`, {
    method: "POST",
    body: formData,
    headers: NGROK_HEADERS,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Đăng ký thất bại" }));
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : JSON.stringify(err.detail) || "Đăng ký thất bại"
    );
  }

  return res.json();
}

export async function searchObject(image: Blob): Promise<SearchResponse> {
  const formData = new FormData();
  formData.append("search_image", image, "search.jpg");

  const res = await fetch(`${API_URL}/api/search`, {
    method: "POST",
    body: formData,
    headers: NGROK_HEADERS,
  });

  if (!res.ok) {
    throw new Error("Tìm kiếm thất bại");
  }

  return res.json();
}

export function resolveImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ detail: fallback }));
  return typeof err.detail === "string"
    ? err.detail
    : JSON.stringify(err.detail) || fallback;
}

export async function listGroups(): Promise<GroupSummary[]> {
  const res = await fetch(`${API_URL}/api/groups`, { headers: NGROK_HEADERS });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được danh sách nhóm"));
  }
  return res.json();
}

export async function createGroup(name: string): Promise<GroupSummary> {
  const res = await fetch(`${API_URL}/api/groups`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Tạo nhóm thất bại"));
  }
  return res.json();
}

export async function getGroupItems(
  groupId: number
): Promise<GroupItemsResponse> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/items`, {
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được vật thể trong nhóm"));
  }
  return res.json();
}

export async function getUngroupedItems(): Promise<UngroupedItemsResponse> {
  const res = await fetch(`${API_URL}/api/objects/ungrouped`, {
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(
      await parseApiError(res, "Không tải được vật thể chưa có nhóm")
    );
  }
  return res.json();
}

export async function getItem(itemId: number): Promise<GroupItem> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}`, {
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được thông tin vật thể"));
  }
  return res.json();
}

export async function updateItem(
  itemId: number,
  data: {
    name?: string;
    description?: string;
    group_id?: number;
    remove_from_group?: boolean;
  }
): Promise<void> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}`, {
    method: "PUT",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Cập nhật vật thể thất bại"));
  }
}

export async function deleteItem(itemId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}`, {
    method: "DELETE",
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Xóa vật thể thất bại"));
  }
}

export async function updateItemImage(
  itemId: number,
  angle: string,
  file: Blob
): Promise<string> {
  const formData = new FormData();
  formData.append("image", file, `${angle}.jpg`);

  const res = await fetch(`${API_URL}/api/objects/${itemId}/images/${angle}`, {
    method: "PUT",
    body: formData,
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Cập nhật ảnh thất bại"));
  }
  const data = await res.json();
  return data.image_url as string;
}

export async function deleteItemImage(
  itemId: number,
  angle: string
): Promise<void> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}/images/${angle}`, {
    method: "DELETE",
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Xóa ảnh thất bại"));
  }
}

export interface GenerateResponse {
  item_id: number;

  content: string;
  persona: string;
  language: string;
}

export async function generateContent(
  itemId: number,
  persona: string = "Mặc định",
  language: string = "Tiếng Việt"
): Promise<GenerateResponse> {
  const res = await fetch(`${API_URL}/api/generate`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, persona, language }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Sinh nội dung thất bại"));
  }
  return res.json();
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  content: string;
}

export async function chatWithAI(
  itemId: number,
  message: string,
  history: ChatMessage[],
  persona: string = "Mặc định",
  language: string = "Tiếng Việt"
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, message, history, persona, language }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Chat thất bại"));
  }
  return res.json();
}

export async function fetchTTSAudio(text: string, language: string = "vi"): Promise<string> {
  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ text, language: language === "Tiếng Việt" ? "vi" : "en" }),
  });
  if (!res.ok) {
    throw new Error("Lỗi tải âm thanh");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Export a generic fetchApi for frontend use
export async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...NGROK_HEADERS, ...options?.headers },
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "API request failed"));
  }
  return res.json();
}
