"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ItemsManagementPanel from "@/components/ItemsManagementPanel";
import {
  ActiveGroup,
  getActiveGroup,
  setActiveGroup,
} from "@/lib/activeGroup";
import { createGroup, GroupSummary, listGroups } from "@/lib/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const syncActiveGroup = useCallback((data: GroupSummary[]) => {
    const stored = getActiveGroup();
    if (!stored) {
      setActiveGroupState(null);
      return;
    }
    const found = data.find((g) => g.id === stored.id);
    if (found) {
      const synced = { id: found.id, name: found.name };
      setActiveGroup(synced);
      setActiveGroupState(synced);
    } else {
      setActiveGroupState(null);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const data = await listGroups();
      setGroups(data);
      syncActiveGroup(data);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được danh sách nhóm",
      });
    }
  }, [syncActiveGroup]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups, refreshToken]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Vui lòng nhập tên nhóm" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const group = await createGroup(trimmed);
      const active = { id: group.id, name: group.name };
      setActiveGroup(active);
      setActiveGroupState(active);
      setNewGroupName("");
      setMessage({
        type: "success",
        text: `Đã tạo nhóm "${group.name}" — dùng cho đăng ký vật thể`,
      });
      setRefreshToken((v) => v + 1);
      await loadGroups();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Tạo nhóm thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản lý nhóm</h1>
        <p className="text-slate-400 text-sm mt-1">
          Tạo nhóm, chọn nhóm đang dùng để đăng ký, quản lý vật thể theo nhóm
        </p>
      </div>

      {activeGroup && (
        <div className="rounded-xl border border-blue-800/50 bg-blue-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-xs text-blue-300/80 uppercase tracking-wide">
              Nhóm đang dùng để đăng ký
            </p>
            <p className="font-medium text-blue-100">{activeGroup.name}</p>
          </div>
          <Link
            href="/register"
            className="text-sm text-blue-400 hover:text-blue-300 hover:underline shrink-0"
          >
            Đi tới đăng ký vật thể →
          </Link>
        </div>
      )}

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-4">
        <h2 className="text-lg font-semibold">Tạo nhóm mới</h2>
        <form
          onSubmit={handleCreateGroup}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Ví dụ: Khuôn viên đại học Vinuni"
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium shrink-0"
          >
            {loading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </form>
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-900/30 text-green-400 border border-green-800"
                : "bg-red-900/30 text-red-400 border border-red-800"
            }`}
          >
            {message.text}
          </div>
        )}
      </section>

      <ItemsManagementPanel
        groups={groups}
        refreshToken={refreshToken}
        onChanged={() => {
          loadGroups();
          setRefreshToken((v) => v + 1);
        }}
        onActiveGroupChange={() => {
          setActiveGroupState(getActiveGroup());
        }}
      />
    </div>
  );
}
