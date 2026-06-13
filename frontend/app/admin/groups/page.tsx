"use client";

import { useCallback, useEffect, useState } from "react";
import GroupDocumentsPanel from "@/components/GroupDocumentsPanel";
import ItemsManagementPanel from "@/components/ItemsManagementPanel";
import { AdminAlert, AdminLink, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { ActiveGroup, getActiveGroup } from "@/lib/activeGroup";
import { GroupSummary, listGroups } from "@/lib/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const loadGroups = useCallback(async () => {
    try {
      const data = await listGroups();
      setGroups(data);
      const stored = getActiveGroup();
      if (!stored) {
        setActiveGroupState(null);
        return;
      }
      const found = data.find((g) => g.id === stored.id);
      setActiveGroupState(found ? { id: found.id, name: found.name } : null);
    } catch {
      /* header handles errors */
    }
  }, []);

  useEffect(() => {
    setActiveGroupState(getActiveGroup());
    loadGroups();

    const onActiveChanged = () => {
      setActiveGroupState(getActiveGroup());
      setRefreshToken((v) => v + 1);
    };
    const onGroupsChanged = () => loadGroups();

    window.addEventListener("active-group-changed", onActiveChanged);
    window.addEventListener("groups-changed", onGroupsChanged);
    return () => {
      window.removeEventListener("active-group-changed", onActiveChanged);
      window.removeEventListener("groups-changed", onGroupsChanged);
    };
  }, [loadGroups]);

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
