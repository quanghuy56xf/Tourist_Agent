"use client";

import type { MapMarker, MapMarkerVariant } from "@/lib/minimapLayers";

const MARKER_STYLES: Record<
  MapMarkerVariant,
  { dot: string; ping?: string; size: string }
> = {
  user: {
    dot: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]",
    ping: "bg-red-400/70",
    size: "h-4 w-4",
  },
  "user-gps": {
    dot: "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.9)]",
    ping: "bg-blue-400/70",
    size: "h-4 w-4",
  },
  suggested: {
    dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
    ping: "bg-amber-300/60",
    size: "h-4 w-4",
  },
  "game-pending": {
    dot: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
    size: "h-3.5 w-3.5",
  },
  "game-found": {
    dot: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]",
    size: "h-3.5 w-3.5",
  },
  "game-target": {
    dot: "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]",
    ping: "bg-amber-300/60",
    size: "h-3.5 w-3.5",
  },
};

interface MapMarkerLayerProps {
  markers: MapMarker[];
}

export default function MapMarkerLayer({ markers }: MapMarkerLayerProps) {
  const sorted = [...markers].sort(
    (left, right) => (left.zIndex ?? 0) - (right.zIndex ?? 0)
  );

  return (
    <>
      {sorted.map((marker) => {
        const style = MARKER_STYLES[marker.variant];
        return (
          <div
            key={marker.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${marker.x}%`,
              top: `${marker.y}%`,
              zIndex: marker.zIndex,
            }}
            aria-label={marker.ariaLabel}
            title={marker.title}
          >
            {style.ping ? (
              <span
                className={`absolute ${(marker.variant === "user" || marker.variant === "user-gps") ? "-inset-2" : "-inset-3"} animate-ping rounded-full ${style.ping}`}
              />
            ) : null}
            <span
              className={`relative block rounded-full border-2 border-white ${style.size} ${style.dot}`}
            />
          </div>
        );
      })}
    </>
  );
}
