"use client";

import { useState } from "react";
import { stopHint, TourStop } from "@/lib/tours";
import type { VisitorLocale } from "@/lib/i18n";

interface TourStopCardProps {
  stop: TourStop;
  index: number;
  completed: boolean;
  isCurrent: boolean;
  stopLabel: string;
  hintLabel: string;
  showDetailsLabel: string;
  hideDetailsLabel: string;
  noDescriptionLabel: string;
  noImageLabel: string;
  locale: VisitorLocale;
}

export default function TourStopCard({
  stop,
  index,
  completed,
  isCurrent,
  stopLabel,
  hintLabel,
  showDetailsLabel,
  hideDetailsLabel,
  noDescriptionLabel,
  noImageLabel,
  locale,
}: TourStopCardProps) {
  const [open, setOpen] = useState(false);
  const detailsId = `tour-stop-details-${stop.itemId}`;
  const hintText = stopHint(stop, locale) || noDescriptionLabel;

  return (
    <div
      className="artifact-card overflow-hidden"
      style={{ borderColor: isCurrent ? "var(--primary)" : undefined }}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className="h-14 w-14 shrink-0 overflow-hidden rounded-xl"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          {stop.imageUrl ? (
            <img
              src={stop.imageUrl}
              alt={stop.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center px-1 text-center text-[10px]"
              style={{ color: "var(--muted-foreground)" }}
            >
              {noImageLabel}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: completed ? "var(--primary)" : "var(--secondary)",
                color: completed ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {completed ? "✓" : index + 1}
            </span>
            <p className="text-xs uppercase tracking-wide" style={{ color: "var(--primary)" }}>
              {stopLabel} {index + 1}
            </p>
          </div>
          <p className="line-clamp-2 text-sm font-bold leading-snug">{stop.name}</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
          style={{
            background: open ? "var(--primary)" : "var(--secondary)",
            color: open ? "var(--primary-foreground)" : "var(--foreground)",
            border: "1px solid var(--border)",
          }}
          title={open ? hideDetailsLabel : showDetailsLabel}
        >
          {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div
          id={detailsId}
          className="border-t px-3 pb-3 pt-2"
          style={{ borderColor: "var(--border)", background: "rgba(14,11,7,0.35)" }}
        >
          <p className="mb-1 text-xs font-medium" style={{ color: "var(--primary)" }}>
            {hintLabel}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
            {hintText}
          </p>
        </div>
      )}
    </div>
  );
}
