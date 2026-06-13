"use client";

import { GroupItem, resolveImageUrl } from "@/lib/api";

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
}: ItemCardProps) {
  return (
    <div className="admin-item-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[rgba(201,168,76,0.06)]"
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
          <p className="font-medium truncate">{item.name}</p>
          <p className="text-xs admin-muted truncate">
            {item.images.length} ảnh · ID {item.id}
          </p>
        </div>
        <span className="text-xs admin-muted shrink-0">
          {expanded ? "Thu gọn" : "Xem chi tiết"}
        </span>
      </button>

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
