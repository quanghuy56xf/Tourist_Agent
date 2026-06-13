"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminAlert,
  AdminButton,
  AdminCard,
  AdminField,
  AdminInput,
  AdminLink,
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/ui";
import { setActiveGroup } from "@/lib/activeGroup";
import {
  createGroup,
  createManagerUser,
  deleteManagerUser,
  GroupSummary,
  listGroups,
  listManagerUsers,
  ManagerUser,
  updateManagerUser,
} from "@/lib/api";

function notifyGroupsChanged() {
  window.dispatchEvent(new CustomEvent("groups-changed"));
}

function GroupCheckboxList({
  groups,
  selected,
  onChange,
}: {
  groups: GroupSummary[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  if (groups.length === 0) {
    return <p className="admin-muted text-sm italic">Chưa có khu di tích nào để gán.</p>;
  }

  const toggle = (groupId: number) => {
    if (selected.includes(groupId)) {
      onChange(selected.filter((id) => id !== groupId));
    } else {
      onChange([...selected, groupId]);
    }
  };

  return (
    <ul className="admin-list max-h-48 overflow-y-auto">
      {groups.map((group) => (
        <li key={group.id} className="admin-list-item py-2">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(group.id)}
              onChange={() => toggle(group.id)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">{group.name}</span>
              <span className="admin-muted ml-2 text-sm">({group.item_count} hiện vật)</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export default function AdminHomePage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [managers, setManagers] = useState<ManagerUser[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newManagerGroups, setNewManagerGroups] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [groupData, managerData] = await Promise.all([listGroups(), listManagerUsers()]);
      setGroups(groupData);
      setManagers(managerData);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được dữ liệu",
      });
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Vui lòng nhập tên khu di tích" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const group = await createGroup(trimmed);
      setActiveGroup({ id: group.id, name: group.name });
      setNewGroupName("");
      setMessage({ type: "success", text: `Đã tạo khu di tích "${group.name}"` });
      await loadData();
      notifyGroupsChanged();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Tạo khu di tích thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newUsername.trim();
    if (!username || !newPassword) {
      setMessage({ type: "error", text: "Vui lòng nhập tên đăng nhập và mật khẩu" });
      return;
    }
    if (newManagerGroups.length === 0) {
      setMessage({ type: "error", text: "Chọn ít nhất một khu di tích cho tài khoản quản lý" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await createManagerUser({
        username,
        password: newPassword,
        group_ids: newManagerGroups,
      });
      setNewUsername("");
      setNewPassword("");
      setNewManagerGroups([]);
      setMessage({ type: "success", text: `Đã tạo tài khoản quản lý "${username}"` });
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Tạo tài khoản thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleManagerActive = async (manager: ManagerUser) => {
    setLoading(true);
    setMessage(null);
    try {
      await updateManagerUser(manager.id, { is_active: !manager.is_active });
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Cập nhật tài khoản thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteManager = async (manager: ManagerUser) => {
    if (!window.confirm(`Xóa tài khoản "${manager.username}"?`)) return;
    setLoading(true);
    setMessage(null);
    try {
      await deleteManagerUser(manager.id);
      setMessage({ type: "success", text: `Đã xóa tài khoản "${manager.username}"` });
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Xóa tài khoản thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Ban quản lý"
        title="Quản lý tài khoản"
        description="Tạo tài khoản quản lý và gán quyền theo từng khu di tích. Admin có full quyền."
      />

      {message && <AdminAlert type={message.type}>{message.text}</AdminAlert>}

      <AdminCard
        title="Tạo tài khoản quản lý"
        description="Mỗi tài khoản quản lý chỉ thấy và chỉnh sửa các khu di tích được gán"
      >
        <form onSubmit={handleCreateManager} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField label="Tên đăng nhập">
              <AdminInput
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="vd: manager-vinuni"
                autoComplete="off"
              />
            </AdminField>
            <AdminField label="Mật khẩu">
              <AdminInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
                autoComplete="new-password"
              />
            </AdminField>
          </div>

          <AdminField label="Khu di tích được quản lý">
            <GroupCheckboxList
              groups={groups}
              selected={newManagerGroups}
              onChange={setNewManagerGroups}
            />
          </AdminField>

          <AdminButton type="submit" disabled={loading}>
            {loading ? "Đang lưu..." : "Tạo tài khoản quản lý"}
          </AdminButton>
        </form>
      </AdminCard>

      <AdminCard title="Danh sách tài khoản quản lý">
        {managers.length === 0 ? (
          <p className="admin-muted text-sm italic">Chưa có tài khoản quản lý nào.</p>
        ) : (
          <ul className="admin-list">
            {managers.map((manager) => (
              <li key={manager.id} className="admin-list-item items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{manager.username}</p>
                    <span className="admin-badge">{manager.is_active ? "active" : "disabled"}</span>
                  </div>
                  <p className="admin-muted mt-1 text-sm">
                    {manager.group_names.length > 0
                      ? manager.group_names.join(", ")
                      : "Chưa gán khu di tích"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => handleToggleManagerActive(manager)}
                  >
                    {manager.is_active ? "Vô hiệu hóa" : "Kích hoạt"}
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => handleDeleteManager(manager)}
                  >
                    Xóa
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard
        title="Quản lý khu di tích"
        description="Tạo khu di tích mới trước khi gán cho tài khoản quản lý"
      >
        <form onSubmit={handleCreateGroup} className="flex flex-col gap-3 sm:flex-row">
          <AdminInput
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Ví dụ: Khuôn viên đại học Vinuni"
            className="flex-1"
          />
          <AdminButton type="submit" disabled={loading} className="shrink-0">
            {loading ? "Đang tạo..." : "Tạo khu di tích"}
          </AdminButton>
        </form>

        {groups.length === 0 ? (
          <p className="admin-muted mt-4 text-sm italic">Chưa có khu di tích nào.</p>
        ) : (
          <ul className="admin-list mt-4">
            {groups.map((group) => (
              <li key={group.id} className="admin-list-item">
                <div>
                  <p className="font-medium">{group.name}</p>
                  <p className="admin-muted text-sm">{group.item_count} hiện vật</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard title="Thông tin sản phẩm">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="admin-muted mb-1">Tên sản phẩm</dt>
            <dd className="font-medium">HERA</dd>
          </div>
          <div>
            <dt className="admin-muted mb-1">Mã dự án</dt>
            <dd className="font-medium">C2-App-060</dd>
          </div>
        </dl>
        <AdminLink href="/admin/product">Xem chi tiết sản phẩm →</AdminLink>
      </AdminCard>
    </AdminPage>
  );
}
