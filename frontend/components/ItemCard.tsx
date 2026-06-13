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
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span
          className={`text-slate-400 text-xs transition-transform ${expanded ? "rotate-90" : ""}`}
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
            className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.name}</p>
          <p className="text-xs text-slate-500 truncate">
            {item.images.length} ảnh · ID {item.id}
          </p>
        </div>
        <span className="text-xs text-slate-500 shrink-0">
          {expanded ? "Thu gọn" : "Xem chi tiết"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-slate-800">
          <div className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-slate-300 w-full sm:w-auto">
                Mô tả vật thể
              </h3>
              <select
                value={selectedPersona}
                onChange={(e) => onPersonaChange(e.target.value)}
                disabled={isBusy || storySaving || storyLoading}
                className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg"
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
                className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg"
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
                  className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
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
              <p className="text-sm text-slate-500">Đang tải mô tả...</p>
            ) : storyError ? (
              <p className="text-sm text-red-400">{storyError}</p>
            ) : isEditingStory ? (
              <>
                <textarea
                  value={editStoryContent}
                  onChange={(e) => onEditStoryContentChange(e.target.value)}
                  rows={6}
                  placeholder="Nội dung mô tả hiển thị cho người dùng"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm resize-none"
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
                    className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {storySaving ? "Đang tạo audio..." : "Lưu mô tả + audio"}
                  </button>
                  <p className="text-xs text-slate-500 w-full">
                    Các persona và ngôn ngữ khác sẽ được AI sinh lại tự động.
                  </p>
                  <button
                    type="button"
                    disabled={isBusy || storySaving}
                    onClick={onCancelEditStory}
                    className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Hủy
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {storyContent || item.description || "Chưa có mô tả."}
                </p>
                {regenNotice && (
                  <p className="text-xs text-blue-300/90">{regenNotice}</p>
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
                      className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                    >
                      Chỉnh sửa mô tả
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <h3 className="text-sm font-medium text-slate-400">Thông tin đăng ký</h3>
            {isEditing ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  placeholder="Tên vật thể"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => onEditDescriptionChange(e.target.value)}
                  rows={3}
                  placeholder="Mô tả ngắn (metadata)"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm resize-none"
                />
              </>
            ) : (
              <p className="text-sm text-slate-500 whitespace-pre-wrap">
                {item.description}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {item.images.map((img) => (
              <div
                key={`${item.id}-${img.angle}`}
                className="rounded-lg border border-slate-700 p-2 space-y-2"
              >
                <p className="text-xs text-slate-400">
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
                    className="flex-1 text-xs py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
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
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800">
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
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  Lưu thông tin
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onCancelEdit}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
                >
                  Hủy
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={onStartEdit}
                className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
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
