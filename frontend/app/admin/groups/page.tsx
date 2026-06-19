"use client";

import { useCallback, useEffect, useState } from "react";
import GroupDocumentsPanel from "@/components/GroupDocumentsPanel";
import ItemsManagementPanel from "@/components/ItemsManagementPanel";
import {
  AdminAlert,
  AdminButton,
  AdminCard,
  AdminLink,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";
import { useAdminGroup } from "@/components/admin/AdminGroupProvider";
import { getAdminSession } from "@/lib/adminAuth";
import { GroupSummary, listGroups, updateGroupVisibility } from "@/lib/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const { activeGroup, setActiveGroup } = useAdminGroup();
  const [refreshToken, setRefreshToken] = useState(0);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const isAdmin = getAdminSession()?.role === "admin";

  const loadGroups = useCallback(async () => {
    try {
      const data = await listGroups();
      setGroups(data);
      const stored = activeGroup;
      if (!stored) {
        setActiveGroup(null);
        return;
      }
      const found = data.find((g) => g.id === stored.id);
      if (found && (found.id !== stored.id || found.name !== stored.name)) {
        setActiveGroup({ id: found.id, name: found.name });
      }
    } catch {
      /* header handles errors */
    }
  }, [activeGroup, setActiveGroup]);

  useEffect(() => {
    loadGroups();

    const onGroupsChanged = () => loadGroups();
    window.addEventListener("groups-changed", onGroupsChanged);
    return () => {
      window.removeEventListener("groups-changed", onGroupsChanged);
    };
  }, [loadGroups]);

  const activeGroupMeta = groups.find((group) => group.id === activeGroup?.id);
  const isPublic = activeGroupMeta?.is_public !== false;

  const handleToggleVisibility = async () => {
    if (!activeGroup || !isAdmin) return;
    setVisibilityLoading(true);
    setMessage(null);
    try {
      await updateGroupVisibility(activeGroup.id, !isPublic);
      setMessage({
        type: "success",
        text: !isPublic
          ? "Đã mở khu di tích cho khách tham quan."
          : "Đã ẩn khu di tích — khách không thể truy cập.",
      });
      await loadGroups();
      window.dispatchEvent(new CustomEvent("groups-changed"));
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không cập nhật được trạng thái hiển thị",
      });
    } finally {
      setVisibilityLoading(false);
    }
  };

  if (!activeGroup) {
    return (
      <AdminPage>
        <AdminAlert type="warning">
          <p className="font-medium">Chưa chọn khu di tích</p>
          <p className="mt-2 text-sm opacity-90">
            Dùng dropdown <strong>Khu di tích</strong> bên phải menu để chọn khu cần quản lý.
            Chưa có khu?{" "}
            <AdminLink href="/admin" className="underline">
              Tạo tại Quản lý tài khoản
            </AdminLink>
            .
          </p>
        </AdminAlert>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Khu di tích"
        title={`Quản lý khu di tích — ${activeGroup.name}`}
        description="Tài liệu tri thức RAG và danh sách hiện vật thuộc khu di tích này"
      />

      {message && <AdminAlert type={message.type}>{message.text}</AdminAlert>}

      {isAdmin && (
        <AdminCard
          title="Hiển thị với khách tham quan"
          description="Khu bị ẩn sẽ không xuất hiện ở trang chọn khu và khách không thể truy cập bằng đường dẫn trực tiếp."
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                Trạng thái:{" "}
                <span style={{ color: isPublic ? "var(--accent)" : undefined }}>
                  {isPublic ? "Đang mở cho khách" : "Đang ẩn"}
                </span>
              </p>
              <p className="admin-muted mt-1 text-sm">
                {isPublic
                  ? "Khách có thể chọn và tham quan khu di tích này."
                  : "Chỉ ban quản lý thấy khu này trong admin; khách không truy cập được."}
              </p>
            </div>
            <AdminButton
              type="button"
              variant={isPublic ? "secondary" : "primary"}
              disabled={visibilityLoading}
              onClick={() => void handleToggleVisibility()}
            >
              {visibilityLoading
                ? "Đang lưu..."
                : isPublic
                  ? "Ẩn khỏi khách tham quan"
                  : "Mở cho khách tham quan"}
            </AdminButton>
          </div>
        </AdminCard>
      )}

      <GroupDocumentsPanel groupId={activeGroup.id} groupName={activeGroup.name} />

      <ItemsManagementPanel
        groups={groups}
        refreshToken={refreshToken}
        fixedGroupId={activeGroup.id}
        hideGroupSelector
        onChanged={() => {
          loadGroups();
          setRefreshToken((v) => v + 1);
        }}
      />
    </AdminPage>
  );
}
