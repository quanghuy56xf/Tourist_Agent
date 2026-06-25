"use client";

import { GroupItem, ItemContentSyncState, resolveImageUrl } from "@/lib/api";

const ANGLE_LABELS: Record<string, string> = {
  front: "Mặt trước",
  side: "Mặt bên",
  back: "Mặt sau",
};

interface ItemCardProps {
  item: GroupItem;
  expanded: boolean;
  onToggle: () => void;
  isEditing: boolean;
  isBusy: boolean;
  editName: string;
  editDescription: string;
  onEditNameChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onReplaceImage: (angle: string) => void;
  onDeleteImage: (angle: string) => void;
  groupActions?: React.ReactNode;
  storyContent: string | null;
  storyLoading: boolean;
  storySaving: boolean;
  storyGenerating: boolean;
  storyError: string | null;
  hasStoryAudio: boolean;
  isStoryPlaying: boolean;
  isEditingStory: boolean;
  editStoryContent: string;
  onEditStoryContentChange: (value: string) => void;
  onStartEditStory: () => void;
  onCancelEditStory: () => void;
  onSaveStory: () => void;
  onGenerateStory: () => void;
  onToggleStoryAudio: () => void;
  personas: readonly string[];
  languages: readonly string[];
  selectedPersona: string;
  selectedLanguage: string;
  onPersonaChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  canEditStory: boolean;
  regenNotice: string | null;
  contentSyncState?: ItemContentSyncState | null;
}

export default function ItemCard({
  item,
  expanded,
  onToggle,
  isEditing,
  isBusy,
  editName,
  editDescription,
  onEditNameChange,
  onEditDescriptionChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onReplaceImage,
  onDeleteImage,
  groupActions,
  storyContent,
  storyLoading,
  storySaving,
  storyGenerating,
  storyError,
  hasStoryAudio,
  isStoryPlaying,
  isEditingStory,
  editStoryContent,
  onEditStoryContentChange,
  onStartEditStory,
  onCancelEditStory,
  onSaveStory,
  onGenerateStory,
  onToggleStoryAudio,
  personas,
  languages,
  selectedPersona,
  selectedLanguage,
  onPersonaChange,
  onLanguageChange,
  canEditStory,
  regenNotice,
  contentSyncState = null,
  onForceSyncItem,
  syncingItem,
}: ItemCardProps & {
  onForceSyncItem?: () => void;
  syncingItem?: boolean;
}) {
  const isContentSyncing = contentSyncState?.state === "syncing";
  return (
    <div className="admin-item-card">
      <div className="flex w-full items-center gap-3 p-4 transition-colors hover:bg-[rgba(201,168,76,0.06)] relative group">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 text-left focus:outline-none"
        >
          <span
            className={`admin-muted text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          {(item.images.find((i) => i.angle === "front")?.url ||
            item.main_image_url) && (
            <img
              src={
                resolveImageUrl(
                  item.images.find((i) => i.angle === "front")?.url ??
                    item.main_image_url
                ) ?? ""
              }
              alt=""
              className="w-10 h-10 object-cover rounded-md border admin-divider shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate flex items-center gap-2">
              {item.name}
              {item.sync_state === "synced" && (
                <span title="Đã đồng bộ đủ" className="flex items-center justify-center text-emerald-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
              {item.sync_state === "missing" && (
                <span title="Đang thiếu nội dung/audio" className="flex items-center justify-center text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </span>
              )}
              {item.sync_state === "outdated" && (
                <span title="Cần đồng bộ lại" className="flex items-center justify-center text-amber-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </span>
              )}
              {isContentSyncing && (
                <span title="Đang sinh mô tả và audio" className="inline-flex items-center gap-1 text-xs font-normal text-amber-600">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Đang cập nhật
                  {contentSyncState ? ` (${contentSyncState.variants_ready}/${contentSyncState.variants_total})` : ""}
                </span>
              )}
            </p>
            <p className="text-xs admin-muted truncate">
              {item.images.length} ảnh · ID {item.id}
            </p>
          </div>
          <span className="text-xs admin-muted shrink-0 mr-8">
            {expanded ? "Thu gọn" : "Xem chi tiết"}
          </span>
        </button>

        {onForceSyncItem && item.sync_state && (
          <button
            type="button"
            title="Đồng bộ lại hiện vật này"
            disabled={syncingItem || isBusy}
            onClick={(e) => {
              e.stopPropagation();
              onForceSyncItem();
            }}
            className="absolute right-4 p-2 rounded-full hover:bg-[var(--border)] transition-colors disabled:opacity-50 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus:outline-none"
          >
            <svg className={`w-4 h-4 ${syncingItem ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t admin-divider">
          <div className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="w-full text-sm font-medium sm:w-auto">
                Mô tả hiện vật
              </h3>
              <select
                value={selectedPersona}
                onChange={(e) => onPersonaChange(e.target.value)}
                disabled={isBusy || storySaving || storyLoading}
                className="admin-input px-3 py-1.5 text-xs"
              >
                {personas.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                disabled={isBusy || storySaving || storyLoading}
                className="admin-input px-3 py-1.5 text-xs"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              {!canEditStory && (
                <span className="text-xs text-amber-300/90">Chỉ xem</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              {!isEditingStory && !storyLoading && storyContent && (
                <button
                  type="button"
                  disabled={isBusy || storySaving}
                  onClick={onToggleStoryAudio}
                  className="admin-btn-secondary text-xs px-3 py-1.5"
                >
                  {hasStoryAudio
                    ? isStoryPlaying
                      ? "⏸ Dừng audio"
                      : "▶ Nghe mô tả"
                    : "Chưa có audio"}
                </button>
              )}
            </div>

            {storyLoading ? (
              <p className="text-sm admin-muted">Đang tải mô tả...</p>
            ) : storyError ? (
              <p className="text-sm text-red-400">{storyError}</p>
            ) : isEditingStory ? (
              <>
                <textarea
                  value={editStoryContent}
                  onChange={(e) => onEditStoryContentChange(e.target.value)}
                  rows={6}
                  placeholder="Nội dung mô tả hiển thị cho người dùng"
                  className="admin-textarea w-full px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy || storySaving || storyGenerating}
                    onClick={onGenerateStory}
                    className="px-4 py-2 text-sm rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50"
                  >
                    {storyGenerating ? "AI đang tạo..." : "AI tạo nội dung"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy || storySaving || storyGenerating}
                    onClick={onSaveStory}
                    className="admin-btn-primary text-sm px-4 py-2"
                  >
                    {storySaving ? "Đang tạo audio..." : "Lưu mô tả + audio"}
                  </button>
                  <p className="text-xs admin-muted w-full">
                    Các persona và ngôn ngữ khác sẽ được AI sinh lại tự động.
                  </p>
                  <button
                    type="button"
                    disabled={isBusy || storySaving}
                    onClick={onCancelEditStory}
                    className="admin-btn-secondary text-sm px-4 py-2"
                  >
                    Hủy
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {storyContent || item.description || "Chưa có mô tả."}
                </p>
                {regenNotice && (
                  <p className="text-xs" style={{ color: "var(--primary)" }}>
                    {regenNotice}
                  </p>
                )}
                {canEditStory && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy || storySaving || storyGenerating}
                      onClick={onGenerateStory}
                      className="px-4 py-2 text-sm rounded-lg bg-violet-700 hover:bg-violet-600 disabled:opacity-50"
                    >
                      {storyGenerating ? "AI đang tạo..." : "AI tạo nội dung"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || storySaving || storyGenerating}
                      onClick={onStartEditStory}
                      className="admin-btn-secondary text-sm px-4 py-2"
                    >
                      Chỉnh sửa mô tả
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t admin-divider">
            <h3 className="text-sm font-medium admin-muted">Thông tin đăng ký</h3>
            {isEditing ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  placeholder="Tên hiện vật"
                  className="admin-input w-full px-3 py-2 text-sm"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => onEditDescriptionChange(e.target.value)}
                  rows={3}
                  placeholder="Mô tả ngắn (metadata)"
                  className="admin-textarea w-full px-3 py-2 text-sm"
                />
              </>
            ) : (
              <p className="text-sm admin-muted whitespace-pre-wrap">
                {item.description}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {item.images.map((img) => (
              <div
                key={`${item.id}-${img.angle}`}
                className="rounded-lg border admin-divider p-2 space-y-2"
              >
                <p className="text-xs admin-muted">
                  {ANGLE_LABELS[img.angle] || img.angle}
                </p>
                <img
                  src={resolveImageUrl(img.url) ?? ""}
                  alt={img.angle}
                  className="w-full h-24 object-cover rounded-md"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onReplaceImage(img.angle)}
                    className="admin-btn-secondary flex-1 py-1.5 text-xs disabled:opacity-50"
                  >
                    Thay ảnh
                  </button>
                  {img.angle !== "front" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onDeleteImage(img.angle)}
                      className="flex-1 text-xs py-1.5 rounded bg-red-900/40 hover:bg-red-900/60 text-red-300 disabled:opacity-50"
                    >
                      Xóa ảnh
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {groupActions && (
            <div className="flex flex-wrap gap-2 pt-1 border-t admin-divider">
              {groupActions}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isEditing ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onSave}
                  className="admin-btn-primary text-sm px-4 py-2"
                >
                  Lưu thông tin
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onCancelEdit}
                  className="admin-btn-secondary text-sm px-4 py-2"
                >
                  Hủy
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={onStartEdit}
                className="admin-btn-secondary text-sm px-4 py-2"
              >
                Chỉnh sửa thông tin
              </button>
            )}
            <button
              type="button"
              disabled={isBusy}
              onClick={onDelete}
              className="px-4 py-2 text-sm rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 disabled:opacity-50"
            >
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
