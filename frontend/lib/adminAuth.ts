export type AdminRole = "admin" | "manager";

export type AdminSession = {
  username: string;
  role: AdminRole;
  token: string;
  groupIds: number[];
};

const STORAGE_KEY = "hera_admin_session";

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession & { group_ids?: number[] };
    const groupIds = Array.isArray(parsed.groupIds)
      ? parsed.groupIds
      : Array.isArray(parsed.group_ids)
        ? parsed.group_ids
        : [];
    if (
      (parsed.role === "admin" || parsed.role === "manager") &&
      typeof parsed.username === "string" &&
      typeof parsed.token === "string"
    ) {
      return { ...parsed, groupIds };
    }
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

export function setAdminSession(session: AdminSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("admin-auth-changed"));
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("admin-auth-changed"));
}

export function defaultAdminPath(role: AdminRole): string {
  return role === "admin" ? "/admin" : "/admin/groups";
}

export function canAccessGroup(session: AdminSession | null, groupId: number): boolean {
  if (!session) return false;
  if (session.role === "admin") return true;
  return session.groupIds.includes(groupId);
}
