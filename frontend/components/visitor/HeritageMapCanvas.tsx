"use client";

import type { MapMarker } from "@/lib/minimapLayers";
import MapMarkerLayer from "./MapMarkerLayer";

interface HeritageMapCanvasProps {
  imageSrc: string;
  mapLabel: string;
  markers: MapMarker[];
  frameClassName?: string;
}

export default function HeritageMapCanvas({
  imageSrc,
  mapLabel,
  markers,
  frameClassName = "relative overflow-hidden rounded-xl border border-amber-300/20 bg-[#211b12]",
}: HeritageMapCanvasProps) {
  return (
    <div className={frameClassName}>
      <img src={imageSrc} alt={mapLabel} className="block h-auto w-full" />
      <MapMarkerLayer markers={markers} />
    </div>
  );
}
