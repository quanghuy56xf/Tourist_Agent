"use client";

import { useMemo } from "react";
import type { MinimapConfig } from "@/lib/api";
import { buildTourMatchMapMarkers } from "@/lib/minimapLayers";
import HeritageMapCanvas from "@/components/visitor/HeritageMapCanvas";
import { useGroupSlug } from "@/lib/useGroupPath";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useGeolocation, calculateUserMapPosition } from "@/lib/minimapGps";

interface TourMatchMinimapProps {
  config: MinimapConfig | null;
  tourItemIds: number[];
  foundItemIds: number[];
  currentTargetItemId: number | null;
  showCurrentTarget: boolean;
  title: string;
  mapLabel: string;
  legendPending: string;
  legendFound: string;
  legendCurrent: string;
}

export default function TourMatchMinimap({
  config,
  tourItemIds,
  foundItemIds,
  currentTargetItemId,
  showCurrentTarget,
  title,
  mapLabel,
  legendPending,
  legendFound,
  legendCurrent,
}: TourMatchMinimapProps) {
  const groupSlug = useGroupSlug();
  const { t } = useVisitorLocale();

  const { position: userGps } = useGeolocation(true);

  const userMapPos = useMemo(
    () => calculateUserMapPosition(userGps, config?.zones ?? []),
    [userGps, config?.zones]
  );

  const markers = useMemo(() => {
    if (!config) return [];
    const list = buildTourMatchMapMarkers(config, {
      tourItemIds,
      foundItemIds,
      currentTargetItemId,
      showCurrentTarget,
      groupSlug,
      userLocationAria: (name) =>
        t.minimap.currentLocationAria.replace("{name}", name),
    });

    if (userMapPos) {
      list.push({
        id: "user-gps",
        x: userMapPos.x,
        y: userMapPos.y,
        variant: "user-gps",
        ariaLabel: "Vị trí GPS của bạn",
        title: "Vị trí của bạn (GPS)",
        zIndex: 40,
      });
    }
    return list;
  }, [
    config,
    tourItemIds,
    foundItemIds,
    currentTargetItemId,
    showCurrentTarget,
    groupSlug,
    t.minimap.currentLocationAria,
    userMapPos,
  ]);

  if (!config) {
    return (
      <div
        className="rounded-xl px-3 py-4 text-center text-xs"
        style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
      >
        {mapLabel}
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <p className="mb-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>
        {title}
      </p>
      <HeritageMapCanvas
        imageSrc={config.imageSrc}
        mapLabel={mapLabel}
        markers={markers}
        frameClassName="relative overflow-hidden rounded-lg border border-amber-300/20 bg-[#211b12]"
      />
      <div className="mt-2 flex flex-wrap gap-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {legendPending}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {legendFound}
        </span>
        {showCurrentTarget ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> {legendCurrent}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full border border-white bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          {t.minimap.userGpsLabel}
        </span>
      </div>
    </div>
  );
}
