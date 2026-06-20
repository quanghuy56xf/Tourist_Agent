export interface MinimapZone {
  zoneId: string;
  zoneName: string;
  x: number;
  y: number;
  itemIds: number[];
}

export interface MinimapConfig {
  groupSlug: string;
  title: string;
  imageSrc: string;
  zones: MinimapZone[];
}

export const MINIMAP_UPDATED_EVENT = "hera-minimap-updated";

const MINIMAP_CONFIGS: Record<string, MinimapConfig> = {
  "quoc-tu-giam": {
    groupSlug: "quoc-tu-giam",
    title: "Bản đồ Văn Miếu - Quốc Tử Giám",
    imageSrc: "/images/van-mieu-minimap.png",
    zones: [
      { zoneId: "cong-chinh", zoneName: "Cổng chính", x: 50, y: 94, itemIds: [7] },
      { zoneId: "dai-trung-mon", zoneName: "Đại Trung Môn", x: 50, y: 79, itemIds: [12] },
      { zoneId: "khue-van-cac", zoneName: "Khuê Văn Các", x: 50, y: 59, itemIds: [9] },
      { zoneId: "vuon-bia", zoneName: "Vườn bia Tiến sĩ", x: 39, y: 46, itemIds: [11] },
      { zoneId: "khu-dai-thanh", zoneName: "Khu Đại Thành", x: 50, y: 35, itemIds: [6, 10, 13] },
      { zoneId: "den-khai-thanh", zoneName: "Đền Khải Thánh", x: 50, y: 11, itemIds: [8] },
    ],
  },
};

export function getMinimapConfig(groupSlug: string): MinimapConfig | null {
  return MINIMAP_CONFIGS[groupSlug] ?? null;
}

export function findMinimapZone(
  config: MinimapConfig,
  itemId: number | null
): MinimapZone | null {
  if (itemId === null) return null;
  return config.zones.find((zone) => zone.itemIds.includes(itemId)) ?? null;
}

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