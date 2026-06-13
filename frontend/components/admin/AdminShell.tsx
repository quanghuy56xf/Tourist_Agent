"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminSession,
  canAccessGroup,
  clearAdminSession,
  defaultAdminPath,
  getAdminSession,
} from "@/lib/adminAuth";
import {
  ActiveGroup,
  clearActiveGroup,
  getActiveGroup,
  setActiveGroup,
} from "@/lib/activeGroup";
import { GroupSummary, listGroups } from "@/lib/api";

const NAV_ITEMS = [
  { href: "/admin", label: "Quản lý tài khoản", adminOnly: true },
  { href: "/admin/groups", label: "Quản lý khu di tích", adminOnly: false },
  { href: "/admin/register", label: "Đăng ký hiện vật", adminOnly: false },
  { href: "/admin/tours", label: "Đăng ký tour khám phá", adminOnly: false },
  { href: "/admin/product", label: "Thông tin sản phẩm", adminOnly: false },
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

function resolveNavPath(pathname: string, items: readonly NavItem[]): string {
  if (pathname === "/admin") return "/admin";
  const matched = items
    .filter((item) => item.href !== "/admin" && pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return matched?.href ?? items[0]?.href ?? "/admin/groups";
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);

  const navItems = useMemo(() => {
    if (session?.role === "admin") return [...NAV_ITEMS];
    return NAV_ITEMS.filter((item) => !item.adminOnly);
  }, [session]);

  const currentNav = useMemo(
    () => resolveNavPath(pathname, navItems),
    [pathname, navItems]
  );

  const homeHref = session ? defaultAdminPath(session.role) : "/admin/login";

  useEffect(() => {
    setSession(getAdminSession());
    const onAuthChange = () => setSession(getAdminSession());
    window.addEventListener("admin-auth-changed", onAuthChange);
    return () => window.removeEventListener("admin-auth-changed", onAuthChange);
  }, []);

  const syncActiveGroup = useCallback((data: GroupSummary[]) => {
    const stored = getActiveGroup();
    if (!stored) {
      setActiveGroupState(null);
      return;
    }
    const found = data.find((g) => g.id === stored.id);
    const session = getAdminSession();
    if (found && (!session || session.role === "admin" || canAccessGroup(session, found.id))) {
      const synced = { id: found.id, name: found.name };
      setActiveGroup(synced);
      setActiveGroupState(synced);
    } else {
      clearActiveGroup();
      setActiveGroupState(null);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const data = await listGroups();
      setGroups(data);
      syncActiveGroup(data);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  }, [syncActiveGroup]);

  useEffect(() => {
    loadGroups();
    const onGroupsChanged = () => loadGroups();
    const onActiveChanged = () => setActiveGroupState(getActiveGroup());
    window.addEventListener("groups-changed", onGroupsChanged);
    window.addEventListener("active-group-changed", onActiveChanged);
    return () => {
      window.removeEventListener("groups-changed", onGroupsChanged);
      window.removeEventListener("active-group-changed", onActiveChanged);
    };
  }, [loadGroups]);

  const handleNavChange = (href: string) => {
    if (href && href !== pathname) router.push(href);
  };

  const handleGroupChange = (value: string) => {
    if (!value) {
      clearActiveGroup();
      setActiveGroupState(null);
      return;
    }
    const groupId = Number(value);
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const next = { id: group.id, name: group.name };
    setActiveGroup(next);
    setActiveGroupState(next);
  };

  const handleLogout = () => {
    clearAdminSession();
    router.replace("/admin/login");
  };

  const groupPlaceholder = groupsLoading
    ? "Đang tải..."
    : groups.length === 0
      ? "Chưa có khu"
      : "Chọn khu di tích";

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="admin-header-top">
            <Link href={homeHref} className="admin-brand min-w-0">
              <span className="admin-brand-icon shrink-0" aria-hidden>
                ✦
              </span>
              <span className="min-w-0 truncate">
                <span className="admin-brand-text">HERA</span>
                <span className="admin-brand-sub ml-2 hidden sm:inline">Ban quản lý</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              {session && (
                <span className="admin-badge hidden sm:inline-flex">{session.role}</span>
              )}
              <button type="button" onClick={handleLogout} className="admin-btn-ghost text-xs">
                Đăng xuất
              </button>
              <Link href="/" className="admin-header-exit">
                <span className="admin-header-exit-short">Khách</span>
                <span className="admin-header-exit-full">Về trang khách</span>
              </Link>
            </div>
          </div>

          <div className="admin-header-controls">
            <div className="admin-header-field">
              <label htmlFor="admin-nav-select" className="admin-field-label truncate">
                Trang
              </label>
              <select
                id="admin-nav-select"
                value={currentNav}
                onChange={(e) => handleNavChange(e.target.value)}
                className="admin-select admin-select-touch"
                aria-label="Menu quản trị"
              >
                {navItems.map((item) => (
                  <option key={item.href} value={item.href}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-header-field">
              <label htmlFor="admin-group-select" className="admin-field-label truncate">
                Khu di tích
              </label>
              <select
                id="admin-group-select"
                value={activeGroup?.id ?? ""}
                onChange={(e) => handleGroupChange(e.target.value)}
                disabled={groupsLoading || groups.length === 0}
                className="admin-select admin-select-touch disabled:opacity-60"
                aria-label="Chọn khu di tích"
              >
                <option value="">{groupPlaceholder}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.item_count})
                  </option>
                ))}
              </select>
            </div>

            <Link href="/" className="admin-header-exit hidden md:inline-flex">
              Về trang khách
            </Link>
          </div>
        </div>

        {activeGroup && pathname.startsWith("/admin/groups") && (
          <div className="admin-header-context">
            <p className="admin-muted text-center text-xs sm:text-right">
              Đang quản lý{" "}
              <span style={{ color: "var(--foreground)" }}>{activeGroup.name}</span>
            </p>
          </div>
        )}
      </header>

      <main className="admin-main">{children}</main>
    </div>
  );
}
