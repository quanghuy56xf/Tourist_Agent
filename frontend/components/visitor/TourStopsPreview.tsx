"use client";

import type { ResolvedTour } from "@/lib/tours";

interface TourStopsPreviewProps {
  tour: ResolvedTour;
  title: string;
  emptyLabel: string;
  maxHeightClassName?: string;
}

export default function TourStopsPreview({
  tour,
  title,
  emptyLabel,
  maxHeightClassName = "max-h-52",
}: TourStopsPreviewProps) {
  if (tour.stops.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl px-3 py-3 ${maxHeightClassName} overflow-y-auto`}
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      <p className="mb-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>
        {title} ({tour.stops.length})
      </p>
      <ol className="space-y-2">
        {tour.stops.map((stop, index) => (
          <li key={stop.itemId} className="flex items-center gap-2.5 text-xs">
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(201, 168, 76, 0.15)",
                border: "1px solid var(--border)",
                color: "var(--primary)",
              }}
            >
              {index + 1}
            </span>
            {stop.imageUrl ? (
              <img
                src={stop.imageUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-md object-cover"
                style={{ border: "1px solid var(--border)" }}
              />
            ) : (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[10px]"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--muted-foreground)",
                }}
              >
                —
              </span>
            )}
            <span className="min-w-0 flex-1 leading-snug" style={{ color: "var(--foreground)" }}>
              {stop.name}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
