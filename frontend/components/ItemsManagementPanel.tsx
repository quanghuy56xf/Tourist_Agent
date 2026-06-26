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
  getGroupContentSyncStatus,
  getItemContent,
  getUngroupedItems,
  GroupItem,
  GroupSummary,
  ItemContentSyncState,
  isEditableContentVariant,
  resolveImageUrl,
  syncMissingGroupContent,
  updateItem,
  updateItemContent,
  updateItemImage,
  getGroupSyncStatus,
  forceSyncGroup,
  forceSyncItem,
  GroupSyncStatusResponse,
} from "@/lib/api";
import { useAdminGroup } from "@/components/admin/AdminGroupProvider";
import { compressImage } from "@/lib/imageCompress";

const SYNC_STATUS_POLL_MS = 60_000;

type BrowseFilter = number | "ungrouped" | null;

const CONTENT_SYNC_POLL_MS = 3000;

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
  const { activeGroup, setActiveGroup } = useAdminGroup();
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
  const [contentSyncing, setContentSyncing] = useState(false);
  const [contentSyncMessage, setContentSyncMessage] = useState<string | null>(null);
  const [itemSyncStates, setItemSyncStates] = useState<Map<number, ItemContentSyncState>>(
    () => new Map()
  );
  const [contentSyncPollRun, setContentSyncPollRun] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [syncStatus, setSyncStatus] = useState<GroupSyncStatusResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingItemId, setSyncingItemId] = useState<number | null>(null);
  const [syncPollRun, setSyncPollRun] = useState(0);
  const forceNextSyncPollRef = useRef(false);

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
    if (activeGroup?.id) {
      setBrowseFilter(activeGroup.id);
    } else {
      setBrowseFilter(null);
    }
  }, [hideGroupSelector, activeGroup]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  }, []);

  const stopStoryAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsStoryPlaying(false);
  }, []);

  const clearStoryContent = useCallback(() => {
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
  }, [stopStoryAudio]);

  const resetStoryState = useCallback(() => {
    clearStoryContent();
    setSelectedPersona(EDITABLE_CONTENT_PERSONA);
    setSelectedLanguage(EDITABLE_CONTENT_LANGUAGE);
  }, [clearStoryContent]);

  useEffect(() => {
    setExpandedId(null);
    cancelEdit();
    resetStoryState();
    setContentSyncMessage(null);
    setContentSyncing(false);
    setItemSyncStates(new Map());
    loadItems();
  }, [cancelEdit, loadItems, refreshToken, resetStoryState]);

  useEffect(() => {
    let active = true;
    let timeoutId: number | null = null;

    if (typeof resolvedFilter !== "number") {
      setItemSyncStates(new Map());
      return;
    }

    const schedule = () => {
      timeoutId = window.setTimeout(() => void poll(), CONTENT_SYNC_POLL_MS);
    };

    const poll = async () => {
      try {
        const status = await getGroupContentSyncStatus(resolvedFilter);
        if (!active) return;
        setItemSyncStates(new Map(status.items.map((row) => [row.item_id, row])));
        const needsWork = status.summary.needs_update > 0;
        if (status.is_sync_active) {
          schedule();
        } else if (contentSyncing) {
          setContentSyncing(false);
          loadItems();
          if (
            !needsWork &&
            status.summary.total > 0 &&
            status.summary.synced === status.summary.total
          ) {
            setContentSyncMessage("Tất cả hiện vật đã có đủ mô tả và audio.");
          } else if (needsWork) {
            setContentSyncMessage(
              `Đã xử lý xong. Còn ${status.summary.needs_update}/${status.summary.total} hiện vật chưa đủ mô tả & audio.`
            );
          }
        } else if (
          !needsWork &&
          status.summary.total > 0 &&
          status.summary.synced === status.summary.total
        ) {
          setContentSyncMessage("Tất cả hiện vật đã có đủ mô tả và audio.");
        }
      } catch (pollError) {
        console.error("Failed to fetch content sync status", pollError);
        if (active && contentSyncing) {
          schedule();
        }
      }
    };

    void poll();

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [resolvedFilter, contentSyncPollRun, contentSyncing, loadItems]);

  const handleUpdateContent = async () => {
    if (typeof resolvedFilter !== "number") return;
    setContentSyncing(true);
    setContentSyncMessage(null);
    setError(null);
    try {
      const result = await syncMissingGroupContent(resolvedFilter);
      setContentSyncMessage(result.message);
      if (result.queued_count === 0) {
        setContentSyncing(false);
      } else {
        setContentSyncPollRun((current) => current + 1);
      }
    } catch (err) {
      setContentSyncing(false);
      setError(err instanceof Error ? err.message : "Cập nhật thông tin thất bại");
    }
  };

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
  }, [clearStoryContent, expandedId, resetStoryState, selectedLanguage, selectedPersona]);

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

  useEffect(() => {
    let active = true;
    let timeoutId: number | null = null;
    if (typeof resolvedFilter !== "number") {
      setSyncStatus(null);
      return;
    }

    const fetchStatus = async (forceNextPoll = false) => {
      try {
        const res = await getGroupSyncStatus(resolvedFilter);
        if (!active) return;
        setSyncStatus(res);
        if (forceNextPoll || !res.is_fully_synced) {
          timeoutId = window.setTimeout(
            () => void fetchStatus(),
            SYNC_STATUS_POLL_MS
          );
        }
      } catch (err) {
        console.error("Failed to fetch sync status", err);
        if (active) {
          timeoutId = window.setTimeout(
            () => void fetchStatus(),
            SYNC_STATUS_POLL_MS
          );
        }
      }
    };

    const forceNextPoll = forceNextSyncPollRef.current;
    forceNextSyncPollRef.current = false;
    void fetchStatus(forceNextPoll);

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [resolvedFilter, syncPollRun]);

  const refreshSyncStatuses = useCallback(() => {
    if (typeof resolvedFilter !== "number") return;
    setContentSyncPollRun((current) => current + 1);
    forceNextSyncPollRef.current = true;
    setSyncPollRun((current) => current + 1);
  }, [resolvedFilter]);

  const handleForceSync = async () => {
    if (typeof resolvedFilter !== "number") return;
    if (!confirm("Xác nhận: Tạo mới mô tả và audio cho tất cả hiện vật?")) return;
    setSyncing(true);
    setError(null);
    try {
      await forceSyncGroup(resolvedFilter);
      forceNextSyncPollRef.current = true;
      setSyncPollRun((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đồng bộ thất bại");
    } finally {
      setSyncing(false);
    }
  };

  const handleForceSyncItem = async (itemId: number) => {
    setSyncingItemId(itemId);
    setError(null);
    try {
      await forceSyncItem(itemId);
      forceNextSyncPollRef.current = true;
      setSyncPollRun((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đồng bộ hiện vật thất bại");
    } finally {
      setSyncingItemId(null);
    }
  };

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
      refreshSyncStatuses();
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
      refreshSyncStatuses();
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
      refreshSyncStatuses();
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
      refreshSyncStatuses();
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
      refreshSyncStatuses();
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

        {typeof resolvedFilter === "number" && !loading && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              disabled={contentSyncing || loading}
              onClick={() => void handleUpdateContent()}
              className="admin-btn-primary px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2 w-fit"
            >
              <svg
                className={`w-4 h-4 ${contentSyncing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {contentSyncing ? "Đang cập nhật thông tin..." : "Cập nhật thông tin"}
            </button>
            {itemSyncStates.size > 0 && (
              <p className="admin-muted text-xs">
                {Array.from(itemSyncStates.values()).filter((row) => row.state === "synced").length}
                /{itemSyncStates.size} hiện vật đã đủ mô tả &amp; audio
              </p>
            )}
          </div>
        )}
        {contentSyncMessage && (
          <p className="text-xs" style={{ color: "var(--primary)" }}>
            {contentSyncMessage}
          </p>
        )}

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
              <p className="admin-muted text-sm">
                <span className="font-medium" style={{ color: "var(--foreground)" }}>{browseLabel}</span>
                {" · "}
                {items.length} hiện vật — bấm thẻ để mở rộng
              </p>
            </div>
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
                  onForceSyncItem={() => handleForceSyncItem(item.id)}
                  syncingItem={syncingItemId === item.id}
                  contentSyncState={itemSyncStates.get(item.id) ?? null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
