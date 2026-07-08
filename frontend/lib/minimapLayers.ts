import type { MinimapConfig, MinimapZone } from "@/lib/api";
import { getVisitedItemIds } from "@/lib/companionState";
import { readRememberedMinimapItem } from "@/lib/minimapState";

export type MapMarkerVariant =
  | "user"
  | "user-gps"
  | "suggested"
  | "game-pending"
  | "game-found"
  | "game-target";

export interface MapMarker {
  id: string;
  x: number;
  y: number;
  variant: MapMarkerVariant;
  ariaLabel?: string;
  title?: string;
  zIndex?: number;
}

export function resolveZoneForItem(
  config: MinimapConfig | null | undefined,
  itemId: number | null
): MinimapZone | null {
  if (!config || itemId === null) return null;
  return config.zones.find((zone) => zone.itemIds.includes(itemId)) ?? null;
}

type ReadStorage = Pick<Storage, "getItem">;

export function resolveUserLocation(
  config: MinimapConfig | null | undefined,
  groupSlug: string,
  sessionStorage: ReadStorage = typeof window !== "undefined"
    ? window.sessionStorage
    : { getItem: () => null }
): { zone: MinimapZone; itemId: number } | null {
  if (!config) return null;

  const lastItemId = readRememberedMinimapItem(groupSlug);
  if (lastItemId !== null) {
    const zone = resolveZoneForItem(config, lastItemId);
    if (zone) return { zone, itemId: lastItemId };
  }

  for (const itemId of [...getVisitedItemIds(sessionStorage)].reverse()) {
    const zone = resolveZoneForItem(config, itemId);
    if (zone) return { zone, itemId };
  }

  return null;
}

export function buildUserMarker(
  zone: MinimapZone,
  ariaLabel: string
): MapMarker {
  return {
    id: `user-${zone.zoneId}`,
    x: zone.x,
    y: zone.y,
    variant: "user",
    ariaLabel,
    title: zone.zoneName,
    zIndex: 30,
  };
}

export function buildSuggestedMarker(
  zone: MinimapZone,
  ariaLabel: string,
  currentZoneId?: string
): MapMarker | null {
  if (currentZoneId && zone.zoneId === currentZoneId) return null;
  return {
    id: `suggested-${zone.zoneId}`,
    x: zone.x,
    y: zone.y,
    variant: "suggested",
    ariaLabel,
    title: zone.zoneName,
    zIndex: 20,
  };
}

export function buildVisitorMapMarkers(
  config: MinimapConfig | null | undefined,
  groupSlug: string,
  suggestedItemId: number | null,
  labels: {
    currentLocationAria: (name: string) => string;
    suggestedLocationAria: (name: string) => string;
  }
): MapMarker[] {
  if (!config) return [];

  const markers: MapMarker[] = [];
  const userLocation = resolveUserLocation(config, groupSlug);

  if (userLocation) {
    markers.push(
      buildUserMarker(
        userLocation.zone,
        labels.currentLocationAria(userLocation.zone.zoneName)
      )
    );
  }

  const suggestedZone = resolveZoneForItem(config, suggestedItemId);
  if (suggestedZone) {
    const suggested = buildSuggestedMarker(
      suggestedZone,
      labels.suggestedLocationAria(suggestedZone.zoneName),
      userLocation?.zone.zoneId
    );
    if (suggested) markers.push(suggested);
  }

  return markers;
}

export function buildTourMatchMapMarkers(
  config: MinimapConfig,
  options: {
    tourItemIds: number[];
    foundItemIds: number[];
    currentTargetItemId: number | null;
    showCurrentTarget: boolean;
    groupSlug: string;
    userLocationAria: (name: string) => string;
  }
): MapMarker[] {
  const {
    tourItemIds,
    foundItemIds,
    currentTargetItemId,
    showCurrentTarget,
    groupSlug,
    userLocationAria,
  } = options;

  const foundSet = new Set(foundItemIds);
  const tourSet = new Set(tourItemIds);
  const markers: MapMarker[] = [];

  for (const zone of config.zones) {
    const zoneTourItems = zone.itemIds.filter((itemId) => tourSet.has(itemId));
    if (zoneTourItems.length === 0) continue;

    const isFound = zoneTourItems.some((itemId) => foundSet.has(itemId));
    const isTarget =
      showCurrentTarget &&
      currentTargetItemId !== null &&
      zoneTourItems.includes(currentTargetItemId);

    let variant: MapMarkerVariant = "game-pending";
    if (isTarget) variant = "game-target";
    else if (isFound) variant = "game-found";

    markers.push({
      id: `game-${zone.zoneId}`,
      x: zone.x,
      y: zone.y,
      variant,
      title: zone.zoneName,
      zIndex: 10,
    });
  }

  return markers;
}
