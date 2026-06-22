import { AdminRole, getAdminSession } from "./adminAuth";
import type { SearchTrackingContext } from "./visitorAnalytics";

// De trong = dung Next.js rewrite (hoat dong qua ngrok frontend)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Goi thang backend chi khi truy cap tu localhost (dev tren may tinh).
// Qua Cloudflare/ngrok tren dien thoai phai dung proxy Next.js (/api -> backend).
function backendDirectBase(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_DIRECT_URL || "";
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return "";
  }
  return configured || "http://127.0.0.1:8000";
}

function uploadBase(): string {
  return backendDirectBase() || API_URL;
}

function contentApiBase(): string {
  return backendDirectBase() || API_URL;
}

const NGROK_HEADERS: HeadersInit = API_URL.includes("ngrok")
  ? { "ngrok-skip-browser-warning": "true" }
  : {};

function apiHeaders(extra?: HeadersInit): HeadersInit {
  const session = getAdminSession();
  const auth: HeadersInit = session?.token
    ? { Authorization: `Bearer ${session.token}` }
    : {};
  return { ...NGROK_HEADERS, ...auth, ...extra };
}

export interface AdminLoginResponse {
  username: string;
  role: AdminRole;
  token: string;
  group_ids: number[];
}

export interface ManagerUser {
  id: number;
  username: string;
  role: AdminRole;
  is_active: boolean;
  group_ids: number[];
  group_names: string[];
  created_at: string;
}

export async function loginAdmin(username: string, password: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Đăng nhập thất bại"));
  return res.json();
}

export async function listManagerUsers(): Promise<ManagerUser[]> {
  const res = await fetch(`${API_URL}/api/users`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Không tải được danh sách tài khoản"));
  return res.json();
}

export async function createManagerUser(payload: {
  username: string;
  password: string;
  group_ids: number[];
}): Promise<ManagerUser> {
  const res = await fetch(`${API_URL}/api/users`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Tạo tài khoản thất bại"));
  return res.json();
}

export async function updateManagerUser(
  userId: number,
  payload: { password?: string; group_ids?: number[]; is_active?: boolean }
): Promise<ManagerUser> {
  const res = await fetch(`${API_URL}/api/users/${userId}`, {
    method: "PUT",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Cập nhật tài khoản thất bại"));
  return res.json();
}

export async function deleteManagerUser(userId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Xóa tài khoản thất bại"));
}

export interface RegisterResponse {
  item_id: number;
  message: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  item_count: number;
  is_public?: boolean;
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
  sync_state?: "synced" | "missing" | "outdated" | null;
}

export interface UngroupedItemsResponse {
  items: GroupItem[];
}

export interface GroupItemsResponse {
  group_id: number;
  group_name: string;
  items: GroupItem[];
}

export interface GroupSyncStatusResponse {
  total_items: number;
  synced_items: number;
  is_fully_synced: boolean;
}

export interface MinimapZone {
  zoneId: string;
  zoneName: string;
  x: number;
  y: number;
  itemIds: number[];
}

export interface MinimapConfig {
  imageSrc: string;
  zones: MinimapZone[];
}

export interface MinimapTemplateZone {
  zoneId: string;
  zoneName: string;
  x: number;
  y: number;
  itemNames: string[];
}

export interface MinimapTemplateConfig {
  imageSrc: string;
  zones: MinimapTemplateZone[];
}

export async function getDynamicMinimapConfig(groupId: number): Promise<MinimapConfig> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/minimap`, {
    headers: { ...NGROK_HEADERS },
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Bản đồ chưa khả dụng"));
  return res.json();
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
    headers: apiHeaders(),
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

export interface BulkRegisterItemResponse {
  status: "success" | "skipped";
  item_id: number | null;
  message: string;
}

export async function bulkRegisterItem(
  formData: FormData
): Promise<BulkRegisterItemResponse> {
  const res = await fetch(`${API_URL}/api/objects/bulk-register-item`, {
    method: "POST",
    body: formData,
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Đăng ký hàng loạt thất bại"));
  }
  return res.json();
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
    headers: apiHeaders(),
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

export async function listPublicGroups(): Promise<GroupSummary[]> {
  const res = await fetch(`${API_URL}/api/groups/public`, {
    headers: { ...NGROK_HEADERS },
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được danh sách khu di tích"));
  }
  return res.json();
}

export async function listDiscoverableGroups(): Promise<GroupSummary[]> {
  const res = await fetch(`${API_URL}/api/groups/discover`, {
    headers: { ...NGROK_HEADERS },
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được danh sách khu di tích"));
  }
  return res.json();
}

export async function listGroups(): Promise<GroupSummary[]> {
  const res = await fetch(`${API_URL}/api/groups`, { headers: apiHeaders() });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được danh sách khu di tích"));
  }
  return res.json();
}

export async function updateGroupVisibility(
  groupId: number,
  isPublic: boolean
): Promise<GroupSummary> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/visibility`, {
    method: "PATCH",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ is_public: isPublic }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không cập nhật được trạng thái hiển thị"));
  }
  return res.json();
}

export async function createGroup(name: string): Promise<GroupSummary> {
  const res = await fetch(`${API_URL}/api/groups`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Tạo khu di tích thất bại"));
  }
  return res.json();
}

export async function getGroupItems(
  groupId: number
): Promise<GroupItemsResponse> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/items`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được hiện vật trong khu di tích"));
  }
  return res.json();
}

export async function getGroupSyncStatus(
  groupId: number
): Promise<GroupSyncStatusResponse> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/sync-status`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không lấy được trạng thái đồng bộ"));
  }
  return res.json();
}

export async function forceSyncGroup(
  groupId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/sync`, {
    method: "POST",
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không thể bắt đầu đồng bộ"));
  }
  return res.json();
}

export async function forceSyncItem(
  itemId: number
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}/sync`, {
    method: "POST",
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không thể bắt đầu đồng bộ hiện vật"));
  }
  return res.json();
}

export async function uploadMinimapConfig(
  groupId: number,
  payload: MinimapTemplateConfig
): Promise<MinimapTemplateConfig> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/minimap`, {
    method: "PUT",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không cập nhật được cấu hình Minimap"));
  }
  return res.json();
}

export async function downloadMinimapTemplate(
  groupId: number
): Promise<MinimapTemplateConfig> {
  const res = await fetch(`${API_URL}/api/groups/${groupId}/minimap/template`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được JSON mẫu"));
  }
  return res.json();
}


export async function getUngroupedItems(): Promise<UngroupedItemsResponse> {
  const res = await fetch(`${API_URL}/api/objects/ungrouped`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(
      await parseApiError(res, "Không tải được hiện vật chưa có khu di tích")
    );
  }
  return res.json();
}

export async function getItem(itemId: number): Promise<GroupItem> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được thông tin hiện vật"));
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
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Cập nhật hiện vật thất bại"));
  }
}

export async function deleteItem(itemId: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/objects/${itemId}`, {
    method: "DELETE",
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Xóa hiện vật thất bại"));
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
    headers: apiHeaders(),
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
    headers: apiHeaders(),
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
    { headers: apiHeaders() }
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
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được tài liệu khu di tích"));
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
    const base = uploadBase();
    const url = `${base}/api/groups/${groupId}/documents`;

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
        const body = xhr.responseText?.trim();
        const suffix = body ? `: ${body.slice(0, 300)}` : "";
        reject(new Error(`HTTP ${xhr.status} ${fallback}${suffix}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Không thể kết nối tới máy chủ khi thêm tài liệu"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload bị hủy"));
    });

    xhr.open("POST", url);
    new Headers(apiHeaders()).forEach((value, key) => {
      xhr.setRequestHeader(key, value);
    });
    if (base.includes("ngrok")) {
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
      headers: apiHeaders(),
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
  audio_status: "pending" | "ready" | "failed";
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
  const res = await fetch(`${contentApiBase()}/api/objects/${itemId}/content?${params}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được nội dung hiện vật"));
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
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
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
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
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
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
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
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
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

export interface CompanionChatResponse extends ChatResponse {
  next_item_id: number | null;
  next_item_name?: string | null;
}

export async function chatWithAI(
  itemId: number,
  message: string,
  history: ChatMessage[],
  persona: string = "Mặc định",
  language: string = "Tiếng Việt",
  tracking?: { sessionId?: string; searchSessionId?: string | null }
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: itemId,
      message,
      history,
      persona,
      language,
      session_id: tracking?.sessionId,
      search_session_id: tracking?.searchSessionId ?? undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Chat thất bại"));
  }
  return res.json();
}
export async function chatWithCompanion(
  itemId: number | null,
  message: string,
  history: ChatMessage[],
  visitedItemIds: number[],
  sessionId?: string,
  suggestNext = false
): Promise<CompanionChatResponse> {
  const res = await fetch(`${API_URL}/api/companion/chat`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      item_id: itemId,
      message,
      history,
      visited_item_ids: visitedItemIds,
      session_id: sessionId,
      suggest_next: suggestNext,
    }),
  });
  if (!res.ok) {
    throw new Error(
      await parseApiError(res, "Không thể trò chuyện với Lê Quý Đôn lúc này")
    );
  }
  return res.json();
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  const extension = audioBlob.type.includes("mp4")
    ? "m4a"
    : audioBlob.type.includes("ogg")
      ? "ogg"
      : "webm";
  formData.append("audio", audioBlob, `speech.${extension}`);

  const res = await fetch(`${API_URL}/api/stt`, {
    method: "POST",
    headers: apiHeaders(),
    body: formData,
  });
  if (!res.ok) {
    throw new Error(
      await parseApiError(res, "Không thể nhận diện giọng nói lúc này")
    );
  }
  const data = (await res.json()) as { transcript?: string };
  const transcript = data.transcript?.trim();
  if (!transcript) throw new Error("Không nhận diện được nội dung giọng nói");
  return transcript;
}



export function toTtsLanguageCode(language: string): "vi" | "en" {
  const normalized = language.trim().toLowerCase();
  if (normalized === "tiếng việt" || normalized === "tieng viet" || normalized.startsWith("vi")) {
    return "vi";
  }
  return "en";
}

export async function fetchTTSAudio(
  text: string,
  language: string = "vi",
  signal?: AbortSignal,
  persona?: "Companion"
): Promise<string> {
  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: toTtsLanguageCode(language),
      persona,
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error("Lỗi tải âm thanh");
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export interface TourStopPayload {
  item_id: number;
  hint_vi?: string;
  hint_en?: string;
}

export interface TourWritePayload {
  title_vi: string;
  title_en: string;
  description_vi?: string;
  description_en?: string;
  is_published?: boolean;
  stops: TourStopPayload[];
}

export interface TourStopDetail {
  item_id: number;
  name: string;
  description: string;
  hint_vi: string;
  hint_en: string;
  image_url: string | null;
  sort_order: number;
}

export interface TourSummary {
  id: number;
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  is_published: boolean;
  stop_count: number;
  created_at: string;
}

export interface TourDetail extends TourSummary {
  stops: TourStopDetail[];
}

export async function listTours(publishedOnly = true): Promise<TourSummary[]> {
  const res = await fetch(`${API_URL}/api/tours?published_only=${publishedOnly}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tours"));
  return res.json();
}

export async function getTour(id: number, publishedOnly = true): Promise<TourDetail> {
  const res = await fetch(
    `${API_URL}/api/tours/${id}?published_only=${publishedOnly}`,
    { headers: apiHeaders() }
  );
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tour"));
  return res.json();
}

export async function listAllItems(): Promise<GroupItem[]> {
  const res = await fetch(`${API_URL}/api/objects/all`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Không tải được danh sách hiện vật"));
  const data = await res.json();
  return data.items ?? [];
}

export async function createTour(payload: TourWritePayload): Promise<TourDetail> {
  const res = await fetch(`${API_URL}/api/tours`, {
    method: "POST",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to create tour"));
  return res.json();
}

export async function updateTour(id: number, payload: TourWritePayload): Promise<TourDetail> {
  const res = await fetch(`${API_URL}/api/tours/${id}`, {
    method: "PUT",
    headers: { ...apiHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to update tour"));
  return res.json();
}

export async function deleteTour(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/api/tours/${id}`, {
    method: "DELETE",
    headers: apiHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to delete tour"));
}

// Export a generic fetchApi for frontend use
export async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...apiHeaders(), ...options?.headers },
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "API request failed"));
  }
  return res.json();
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface GroupActivityStats {
  group_id: number;
  group_name: string;
  visits: number;
  searches: number;
  visit_trend: DailyCount[];
  search_trend: DailyCount[];
}

export interface AnalyticsSummary {
  range_days: number;
  total_visits: number;
  total_searches: number;
  groups: GroupActivityStats[];
  chat_per_search: {
    avg_questions: number;
    sessions_with_search: number;
    distribution: Array<{ questions: number; sessions: number }>;
  };
  session_durations: Array<{
    group_id: number;
    group_name: string;
    client_ip: string;
    session_id: string;
    duration_seconds: number;
    event_count: number;
    last_seen: string;
  }>;
  search_timing: {
    count: number;
    avg_ms: number;
    slow_count: number;
    error_count: number;
  };
  chat_timing: {
    count: number;
    avg_ms: number;
    slow_count: number;
    error_count: number;
  };
  slow_events: AnalyticsIssueRow[];
  recent_errors: AnalyticsIssueRow[];
}

export interface AnalyticsIssueRow {
  event_type: string;
  duration_ms: number | null;
  group_name: string | null;
  item_name: string | null;
  client_ip: string | null;
  error_detail: string | null;
  created_at: string;
}

export async function fetchAnalyticsSummary(
  days = 30,
  groupId?: number
): Promise<AnalyticsSummary> {
  const params = new URLSearchParams({ days: String(days) });
  if (groupId != null) params.set("group_id", String(groupId));
  const res = await fetch(`${API_URL}/api/analytics/summary?${params}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Không tải được thống kê"));
  }
  return res.json();
}
