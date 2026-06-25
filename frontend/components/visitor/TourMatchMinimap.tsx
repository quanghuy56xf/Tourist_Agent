"use client";

import type { MinimapConfig } from "@/lib/api";

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

  const foundSet = new Set(foundItemIds);
  const tourSet = new Set(tourItemIds);

  const zones = config.zones.filter((zone) =>
    zone.itemIds.some((itemId) => tourSet.has(itemId))
  );

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <p className="mb-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>
        {title}
      </p>
      <div className="relative overflow-hidden rounded-lg border border-amber-300/20 bg-[#211b12]">
        <img src={config.imageSrc} alt={mapLabel} className="block h-auto w-full" />
        {zones.map((zone) => {
          const zoneTourItems = zone.itemIds.filter((itemId) => tourSet.has(itemId));
          const isFound = zoneTourItems.some((itemId) => foundSet.has(itemId));
          const isCurrent =
            showCurrentTarget &&
            currentTargetItemId !== null &&
            zoneTourItems.includes(currentTargetItemId);
          const colorClass = isCurrent
            ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
            : isFound
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]";

          return (
            <div
              key={zone.zoneId}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              title={zone.zoneName}
            >
              {isCurrent ? (
                <span className="absolute -inset-3 animate-ping rounded-full bg-amber-300/60" />
              ) : null}
              <span
                className={`relative block h-3.5 w-3.5 rounded-full border-2 border-white ${colorClass}`}
              />
            </div>
          );
        })}
      </div>
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
      </div>
    </div>
  );
}
