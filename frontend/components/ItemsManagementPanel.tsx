"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ItemCard from "@/components/ItemCard";
import {
  CONTENT_LANGUAGES,
  CONTENT_PERSONAS,
  EDITABLE_CONTENT_LANGUAGE,
  EDITABLE_CONTENT_PERSONA,
  deleteItem,
  deleteItemImage,
  generateItemContentDraft,
  getGroupItems,
  getItemContent,
  getUngroupedItems,
  GroupItem,
  GroupSummary,
  isEditableContentVariant,
  resolveImageUrl,
  updateItem,
  updateItemContent,
  updateItemImage,
} from "@/lib/api";
import { getActiveGroup, setActiveGroup } from "@/lib/activeGroup";
import { compressImage } from "@/lib/imageCompress";

type BrowseFilter = number | "ungrouped" | null;

interface ItemsManagementPanelProps {
  groups: GroupSummary[];
  refreshToken: number;
  onChanged: () => void;
  onActiveGroupChange?: (groupId: number | null) => void;
  fixedGroupId?: number | null;
  hideGroupSelector?: boolean;
}

export default function ItemsManagementPanel({
  groups,
  refreshToken,
  onChanged,
  onActiveGroupChange,
  fixedGroupId,
  hideGroupSelector = false,
}: ItemsManagementPanelProps) {
  const [browseFilter, setBrowseFilter] = useState<BrowseFilter>(null);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [browseLabel, setBrowseLabel] = useState("");
  const [ungroupedCount, setUngroupedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<number | "">("");
  const [listVersion, setListVersion] = useState(0);
  const [storyContent, setStoryContent] = useState<string | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storySaving, setStorySaving] = useState(false);
  const [storyGenerating, setStoryGenerating] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [hasStoryAudio, setHasStoryAudio] = useState(false);
  const [storyAudioUrl, setStoryAudioUrl] = useState<string | null>(null);
  const [isStoryPlaying, setIsStoryPlaying] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [editStoryContent, setEditStoryContent] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<string>(EDITABLE_CONTENT_PERSONA);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(EDITABLE_CONTENT_LANGUAGE);
  const [regenNotice, setRegenNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canEditStory = isEditableContentVariant(selectedPersona, selectedLanguage);

  const refreshCounts = useCallback(async () => {
    try {
      const ungrouped = await getUngroupedItems();
      setUngroupedCount(ungrouped.items.length);
    } catch {
      setUngroupedCount(0);
    }
  }, []);

  const resolvedFilter: BrowseFilter = hideGroupSelector
    ? fixedGroupId ?? null
    : browseFilter;

  const loadItems = useCallback(async () => {
    if (resolvedFilter === null) {
      setItems([]);
      setBrowseLabel("");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (resolvedFilter === "ungrouped") {
        const data = await getUngroupedItems();
        setItems(data.items);
        setBrowseLabel("Chưa có khu di tích");
        setUngroupedCount(data.items.length);
      } else {
        const data = await getGroupItems(resolvedFilter);
        setItems(data.items);
        setBrowseLabel(data.group_name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, refreshToken]);

  useEffect(() => {
    if (hideGroupSelector) return;
    const active = getActiveGroup();
    if (active?.id) {
      setBrowseFilter(active.id);
    }
  }, [hideGroupSelector]);

  useEffect(() => {
    if (hideGroupSelector) return;
    const onActiveChanged = () => {
      const active = getActiveGroup();
      setBrowseFilter(active?.id ?? null);
    };
    window.addEventListener("active-group-changed", onActiveChanged);
    return () => window.removeEventListener("active-group-changed", onActiveChanged);
  }, [hideGroupSelector]);

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const stopStoryAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsStoryPlaying(false);
  };

  const clearStoryContent = () => {
    setStoryContent(null);
    setStoryLoading(false);
    setStorySaving(false);
    setStoryGenerating(false);
    setStoryError(null);
    setHasStoryAudio(false);
    setStoryAudioUrl(null);
    setIsEditingStory(false);
    setEditStoryContent("");
    setRegenNotice(null);
    stopStoryAudio();
  };

  const resetStoryState = () => {
    clearStoryContent();
    setSelectedPersona(EDITABLE_CONTENT_PERSONA);
    setSelectedLanguage(EDITABLE_CONTENT_LANGUAGE);
  };

  useEffect(() => {
    setExpandedId(null);
    cancelEdit();
    resetStoryState();
    loadItems();
  }, [loadItems, refreshToken]);

  useEffect(() => {
    if (expandedId === null) {
      resetStoryState();
      return;
    }

    let cancelled = false;
    clearStoryContent();
    setStoryLoading(true);

    getItemContent(expandedId, selectedPersona, selectedLanguage)
      .then((data) => {
        if (cancelled) return;
        setStoryContent(data.content);
        setHasStoryAudio(data.has_audio);
        setStoryAudioUrl(
          data.audio_url ? resolveImageUrl(data.audio_url) : null
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setStoryError(
          err instanceof Error ? err.message : "Không tải được mô tả"
        );
      })
      .finally(() => {
        if (!cancelled) setStoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expandedId, selectedPersona, selectedLanguage]);

  useEffect(() => {
    if (isEditingStory && !canEditStory) {
      setIsEditingStory(false);
      setEditStoryContent("");
    }
  }, [canEditStory, isEditingStory]);

  useEffect(() => {
    if (groups.length > 0 && assignGroupId === "") {
      setAssignGroupId(groups[0].id);
    }
  }, [groups, assignGroupId]);

  const startEditStory = () => {
    setIsEditingStory(true);
    setEditStoryContent(storyContent || "");
  };

  const cancelEditStory = () => {
    setIsEditingStory(false);
    setEditStoryContent("");
  };

  const handleSaveStory = async (itemId: number) => {
    const trimmed = editStoryContent.trim();
    if (!trimmed) {
      setError("Nội dung mô tả không được để trống");
      return;
    }

    setStorySaving(true);
    setBusyId(itemId);
    setError(null);
    try {
      const updated = await updateItemContent(
        itemId,
        trimmed,
        EDITABLE_CONTENT_PERSONA,
        EDITABLE_CONTENT_LANGUAGE
      );
      setStoryContent(updated.content);
      setHasStoryAudio(updated.has_audio);
      setStoryAudioUrl(
        updated.audio_url ? resolveImageUrl(updated.audio_url) : null
      );
      setRegenNotice(
        "Đã lưu persona Mặc định. Các persona/ngôn ngữ khác đang được AI sinh lại..."
      );
      setIsEditingStory(false);
      setEditStoryContent("");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsStoryPlaying(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật mô tả thất bại");
    } finally {
      setStorySaving(false);
      setBusyId(null);
    }
  };

  const handleGenerateStoryWithAI = async (itemId: number) => {
    setStoryGenerating(true);
    setBusyId(itemId);
    setError(null);
    try {
      const draft = await generateItemContentDraft(
        itemId,
        EDITABLE_CONTENT_PERSONA,
        EDITABLE_CONTENT_LANGUAGE
      );
      setEditStoryContent(draft.content);
      setIsEditingStory(true);
      setRegenNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI không thể tạo nội dung");
    } finally {
      setStoryGenerating(false);
      setBusyId(null);
    }
  };

  const handleToggleStoryAudio = () => {
    if (!storyContent?.trim() || !storyAudioUrl) return;

    if (isStoryPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsStoryPlaying(false);
      return;
    }

    const audio = new Audio(storyAudioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsStoryPlaying(false);
    audio.onerror = () => {
      setIsStoryPlaying(false);
      setError("Không phát được audio mô tả");
    };
    void audio.play().then(() => setIsStoryPlaying(true)).catch(() => {
      setError("Không phát được audio mô tả");
    });
  };

  const startEdit = (item: GroupItem) => {
    setEditingId(item.id);
    setExpandedId(item.id);
    setEditName(item.name);
    setEditDescription(item.description);
  };

  const handleSave = async (itemId: number) => {
    if (!editName.trim() || !editDescription.trim()) {
      setError("Tên và mô tả không được để trống");
      return;
    }
    setBusyId(itemId);
    setError(null);
    try {
      await updateItem(itemId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      cancelEdit();
      await loadItems();
      await refreshCounts();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteItem = async (item: GroupItem) => {
    if (!confirm(`Xóa vĩnh viễn "${item.name}"? Hành động này không thể hoàn tác.`))
      return;
    setBusyId(item.id);
    setError(null);
    try {
      await deleteItem(item.id);
      cancelEdit();
      setExpandedId(null);
      setListVersion((v) => v + 1);
      await loadItems();
      await refreshCounts();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const handleReplaceImage = async (itemId: number, angle: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusyId(itemId);
      setError(null);
      try {
        const compressed = await compressImage(file);
        await updateItemImage(itemId, angle, compressed);
        await loadItems();
        onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Thay ảnh thất bại");
      } finally {
        setBusyId(null);
      }
    };
    input.click();
  };

  const handleDeleteImage = async (itemId: number, angle: string) => {
    if (!confirm(`Xóa ảnh này?`)) return;
    setBusyId(itemId);
    setError(null);
    try {
      await deleteItemImage(itemId, angle);
      await loadItems();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa ảnh thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveFromGroup = async (item: GroupItem) => {
    if (!confirm(`Gỡ "${item.name}" khỏi khu di tích "${browseLabel}"?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await updateItem(item.id, { remove_from_group: true });
      await loadItems();
      await refreshCounts();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gỡ khu di tích thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignToGroup = async (item: GroupItem) => {
    if (!assignGroupId) {
      setError("Chọn khu di tích đích trước khi gán");
      return;
    }
    const target = groups.find((g) => g.id === assignGroupId);
    if (!target) return;

    setBusyId(item.id);
    setError(null);
    try {
      await updateItem(item.id, { group_id: assignGroupId });
      await loadItems();
      await refreshCounts();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gán khu di tích thất bại");
    } finally {
      setBusyId(null);
    }
  };

  const renderGroupActions = (item: GroupItem) => {
    if (resolvedFilter === "ungrouped") {
      return (
        <>
          <select
            value={assignGroupId}
            onChange={(e) =>
              setAssignGroupId(e.target.value ? Number(e.target.value) : "")
            }
            className="admin-select min-w-[140px] flex-1 px-3 py-1.5 text-sm"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busyId === item.id || groups.length === 0}
            onClick={() => handleAssignToGroup(item)}
            className="admin-btn-secondary px-4 py-1.5 text-sm disabled:opacity-50"
          >
            Gán vào khu di tích
          </button>
        </>
      );
    }

    if (typeof resolvedFilter === "number") {
      return (
        <button
          type="button"
          disabled={busyId === item.id}
          onClick={() => handleRemoveFromGroup(item)}
          className="admin-btn-secondary px-4 py-1.5 text-sm disabled:opacity-50"
        >
          Gỡ khỏi khu di tích
        </button>
      );
    }

    return null;
  };

  return (
    <section className="admin-card overflow-hidden">
      <div className="space-y-3 border-b admin-divider p-4">
        <div>
          <h2 className="admin-card-title">Quản lý hiện vật</h2>
          <p className="admin-subtitle mt-1">
            {hideGroupSelector
              ? "Danh sách hiện vật trong khu di tích đang chọn"
              : "Chọn khu di tích để xem và chỉnh sửa danh sách hiện vật"}
          </p>
        </div>

        {!hideGroupSelector && (
        <div>
          <label className="admin-label mb-1.5">
            Chọn khu di tích để xem &amp; đăng ký hiện vật
          </label>
          <select
            value={browseFilter === null ? "" : String(browseFilter)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                setBrowseFilter(null);
              } else if (v === "ungrouped") {
                setBrowseFilter("ungrouped");
              } else {
                const groupId = Number(v);
                const group = groups.find((g) => g.id === groupId);
                setBrowseFilter(groupId);
                if (group) {
                  setActiveGroup({ id: group.id, name: group.name });
                  onActiveGroupChange?.(group.id);
                }
              }
            }}
            className="admin-select w-full text-sm"
          >
            <option value="">— Chọn khu di tích để xem hiện vật —</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.item_count} hiện vật)
              </option>
            ))}
            <option value="ungrouped">
              Chưa có khu di tích ({ungroupedCount} hiện vật)
            </option>
          </select>
        </div>
        )}
      </div>

      <div className="p-4 space-y-4 min-h-[80px]">
        {error && (
          <div className="admin-alert admin-alert-error text-sm">
            {error}
          </div>
        )}

        {resolvedFilter === null ? (
          <p className="admin-muted py-6 text-center text-sm">
            {hideGroupSelector
              ? "Chọn khu di tích từ dropdown bên phải menu để xem hiện vật."
              : 'Chọn một khu di tích hoặc "Chưa có khu di tích" ở trên để hiển thị danh sách hiện vật.'}
          </p>
        ) : loading ? (
          <p className="admin-muted py-6 text-center text-sm">
            Đang tải hiện vật...
          </p>
        ) : items.length === 0 ? (
          <p className="admin-muted py-6 text-center text-sm">
            {resolvedFilter === "ungrouped"
              ? "Không có hiện vật nào chưa thuộc khu di tích."
              : `Khu di tích "${browseLabel}" chưa có hiện vật nào.`}
          </p>
        ) : (
          <>
            <p className="admin-muted text-sm">
              <span className="font-medium" style={{ color: "var(--foreground)" }}>{browseLabel}</span>
              {" · "}
              {items.length} hiện vật — bấm thẻ để mở rộng
            </p>
            <div className="space-y-3">
              {items.map((item) => (
                <ItemCard
                  key={`${item.id}-${listVersion}`}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === item.id ? null : item.id))
                  }
                  isEditing={editingId === item.id}
                  isBusy={busyId === item.id}
                  editName={editName}
                  editDescription={editDescription}
                  onEditNameChange={setEditName}
                  onEditDescriptionChange={setEditDescription}
                  onStartEdit={() => startEdit(item)}
                  onCancelEdit={cancelEdit}
                  onSave={() => handleSave(item.id)}
                  onDelete={() => handleDeleteItem(item)}
                  onReplaceImage={(angle) => handleReplaceImage(item.id, angle)}
                  onDeleteImage={(angle) => handleDeleteImage(item.id, angle)}
                  groupActions={renderGroupActions(item)}
                  storyContent={expandedId === item.id ? storyContent : null}
                  storyLoading={expandedId === item.id && storyLoading}
                  storySaving={expandedId === item.id && storySaving}
                  storyGenerating={expandedId === item.id && storyGenerating}
                  storyError={expandedId === item.id ? storyError : null}
                  hasStoryAudio={expandedId === item.id && hasStoryAudio}
                  isStoryPlaying={expandedId === item.id && isStoryPlaying}
                  isEditingStory={expandedId === item.id && isEditingStory}
                  editStoryContent={editStoryContent}
                  onEditStoryContentChange={setEditStoryContent}
                  onStartEditStory={startEditStory}
                  onCancelEditStory={cancelEditStory}
                  onSaveStory={() => handleSaveStory(item.id)}
                  onGenerateStory={() => handleGenerateStoryWithAI(item.id)}
                  onToggleStoryAudio={handleToggleStoryAudio}
                  personas={CONTENT_PERSONAS}
                  languages={CONTENT_LANGUAGES}
                  selectedPersona={selectedPersona}
                  selectedLanguage={selectedLanguage}
                  onPersonaChange={setSelectedPersona}
                  onLanguageChange={setSelectedLanguage}
                  canEditStory={canEditStory}
                  regenNotice={expandedId === item.id ? regenNotice : null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
