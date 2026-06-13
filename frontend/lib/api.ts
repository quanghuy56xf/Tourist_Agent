// De trong = dung Next.js rewrite (hoat dong qua ngrok frontend)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// File lon (vd PDF scan) upload thang vao backend de tranh gioi han proxy Next.js.
// De trong = dung proxy nhu cu (hop ngrok).
const UPLOAD_BASE = process.env.NEXT_PUBLIC_BACKEND_DIRECT_URL || API_URL;
// Sinh/tai noi dung persona co the mat 30s+ — goi thang backend neu co.
const CONTENT_API_BASE = process.env.NEXT_PUBLIC_BACKEND_DIRECT_URL || API_URL;

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

export interface GroupDocumentSummary {
  id: number;
  group_id: number;
  title: string;
  source_type: string;
  original_filename: string | null;
  chunk_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupDocumentDetail extends GroupDocumentSummary {
  extracted_text: string;
}

export async function getGroupDocument(
  groupId: number,
  documentId: number
): Promise<GroupDocumentDetail> {
  const res = await fetch(
    `${API_URL}/api/groups/${groupId}/documents/${documentId}`,
    { headers: NGROK_HEADERS }
  );
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được nội dung tài liệu"));
  }
  return res.json();
}

export async function listGroupDocuments(
  groupId: number
): Promise<GroupDocumentSummary[]> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/documents`, {
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được tài liệu nhóm"));
  }
  return res.json();
}

export type GroupDocumentUploadPhase = "uploading" | "encoding" | "complete";

export function createGroupDocument(
  groupId: number,
  formData: FormData,
  onPhaseChange?: (phase: GroupDocumentUploadPhase) => void
): Promise<GroupDocumentSummary> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${UPLOAD_BASE}/api/groups/${groupId}/documents`;

    onPhaseChange?.("uploading");

    xhr.upload.addEventListener("load", () => {
      onPhaseChange?.("encoding");
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onPhaseChange?.("complete");
        try {
          resolve(JSON.parse(xhr.responseText) as GroupDocumentSummary);
        } catch {
          reject(new Error("Thêm tài liệu thất bại"));
        }
        return;
      }

      const fallback = "Thêm tài liệu thất bại";
      try {
        const err = JSON.parse(xhr.responseText) as { detail?: unknown };
        const detail = err.detail;
        reject(
          new Error(
            typeof detail === "string"
              ? detail
              : detail
                ? JSON.stringify(detail)
                : fallback
          )
        );
      } catch {
        reject(new Error(fallback));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Thêm tài liệu thất bại"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload bị hủy"));
    });

    xhr.open("POST", url);
    if (UPLOAD_BASE.includes("ngrok")) {
      xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
    }
    xhr.send(formData);
  });
}

export async function deleteGroupDocument(
  groupId: number,
  documentId: number
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/groups/${groupId}/documents/${documentId}`,
    {
      method: "DELETE",
      headers: NGROK_HEADERS,
    }
  );
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Xóa tài liệu thất bại"));
  }
}

export interface ItemContentResponse {
  item_id: number;
  persona: string;
  language: string;
  content: string;
  has_audio: boolean;
  audio_url: string | null;
  stored: boolean;
  source: string;
}

export const CONTENT_PERSONAS = [
  "Mặc định",
  "Gen Z Explorer",
  "Family Visitor",
] as const;

export const CONTENT_LANGUAGES = ["Tiếng Việt", "Tiếng Anh"] as const;

export const EDITABLE_CONTENT_PERSONA = "Mặc định";
export const EDITABLE_CONTENT_LANGUAGE = "Tiếng Việt";

export function isEditableContentVariant(persona: string, language: string): boolean {
  return persona === EDITABLE_CONTENT_PERSONA && language === EDITABLE_CONTENT_LANGUAGE;
}

export async function getItemContent(
  itemId: number,
  persona: string = "Mặc định",
  language: string = "Tiếng Việt"
): Promise<ItemContentResponse> {
  const params = new URLSearchParams({ persona, language });
  const res = await fetch(`${CONTENT_API_BASE}/api/objects/${itemId}/content?${params}`, {
    headers: NGROK_HEADERS,
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được nội dung vật thể"));
  }
  return res.json();
}

export async function updateItemContent(
  itemId: number,
  content: string,
  persona: string = "Mặc định",
  language: string = "Tiếng Việt"
): Promise<ItemContentResponse> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}/content`, {
    method: "PUT",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ content, persona, language }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Cập nhật mô tả thất bại"));
  }
  return res.json();
}

export interface ItemContentDraftResponse {
  item_id: number;
  persona: string;
  language: string;
  content: string;
}

export async function generateItemContentDraft(
  itemId: number,
  persona: string = EDITABLE_CONTENT_PERSONA,
  language: string = EDITABLE_CONTENT_LANGUAGE
): Promise<ItemContentDraftResponse> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}/content/draft`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ persona, language }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "AI không thể tạo nội dung lúc này"));
  }
  return res.json();
}

export interface BulkRegenerateContentResponse {
  updated_count: number;
  skipped_count: number;
  updated_item_ids: number[];
  skipped_item_ids: number[];
}

export async function bulkRegenerateGroupContent(
  groupId: number,
  documentIds?: number[]
): Promise<BulkRegenerateContentResponse> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/content/bulk-regenerate`, {
    method: "POST",
    headers: { ...NGROK_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ document_ids: documentIds ?? null }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Cập nhật mô tả hàng loạt thất bại"));
  }
  return res.json();
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
