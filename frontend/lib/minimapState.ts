export const MINIMAP_UPDATED_EVENT = "hera-minimap-updated";

export function minimapStorageKey(groupSlug: string): string {
  return `hera_last_item_${groupSlug}`;
}

export function minimapUnreadStorageKey(groupSlug: string): string {
  return `hera_minimap_unread_${groupSlug}`;
}

export function rememberMinimapItem(groupSlug: string, itemId: number): void {
  if (typeof window === "undefined" || !Number.isInteger(itemId)) return;
  try {
    window.localStorage.setItem(minimapStorageKey(groupSlug), String(itemId));
    window.localStorage.setItem(minimapUnreadStorageKey(groupSlug), "true");
    window.dispatchEvent(
      new CustomEvent(MINIMAP_UPDATED_EVENT, { detail: { groupSlug } })
    );
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function readRememberedMinimapItem(groupSlug: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(minimapStorageKey(groupSlug));
    if (value === null) return null;
    const itemId = Number(value);
    return Number.isInteger(itemId) ? itemId : null;
  } catch {
    return null;
  }
}

export function hasUnreadMinimap(groupSlug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(minimapUnreadStorageKey(groupSlug)) === "true";
  } catch {
    return false;
  }
}

export function markMinimapSeen(groupSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(minimapUnreadStorageKey(groupSlug));
  } catch {
    // Opening the minimap should still work when storage is unavailable.
  }
}
