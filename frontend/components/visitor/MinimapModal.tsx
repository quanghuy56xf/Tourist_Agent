"use client";

import { useEffect, useState } from "react";
import type { MinimapConfig } from "@/lib/api";
import { readRememberedMinimapItem } from "@/lib/minimapState";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface MinimapModalProps {
  open: boolean;
  onClose: () => void;
  groupSlug: string;
  config: MinimapConfig | null;
  suggestedItemId: number | null;
  suggestedItemName?: string | null;
}

export default function MinimapModal({
  open,
  onClose,
  groupSlug,
  config,
  suggestedItemId,
  suggestedItemName,
}: MinimapModalProps) {
  const { t } = useVisitorLocale();
  const [lastItemId, setLastItemId] = useState<number | null>(null);
  const currentZone =
    lastItemId === null
      ? null
      : config?.zones.find((zone) => zone.itemIds.includes(lastItemId)) ?? null;
  const suggestedZone =
    suggestedItemId === null
      ? null
      : config?.zones.find((zone) => zone.itemIds.includes(suggestedItemId)) ?? null;

  useEffect(() => {
    if (!open) return;
    setLastItemId(readRememberedMinimapItem(groupSlug));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [groupSlug, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.minimap.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-400/30 bg-[#17130d] p-4 text-amber-50 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-amber-400">
              {t.minimap.journey}
            </p>
            <h2 className="mt-1 font-serif text-xl font-semibold">
              {t.minimap.mapLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-amber-200/20 bg-white/5 text-xl text-amber-100 transition hover:bg-white/10"
            aria-label={t.minimap.close}
          >
            ×
          </button>
        </div>

        {config ? (
          <>
            <div className="relative overflow-hidden rounded-xl border border-amber-300/20 bg-[#211b12]">
              <img
                src={config.imageSrc}
                alt={t.minimap.mapLabel}
                className="block h-auto w-full"
              />
              {currentZone && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${currentZone.x}%`, top: `${currentZone.y}%` }}
                  aria-label={`Vị trí hiện tại: ${currentZone.zoneName}`}
                >
                  <span className="absolute -inset-2 animate-ping rounded-full bg-red-400/70" />
                  <span className="relative block h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                </div>
              )}
              {suggestedZone && suggestedZone.zoneId !== currentZone?.zoneId && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${suggestedZone.x}%`, top: `${suggestedZone.y}%` }}
                  aria-label={`Điểm được gợi ý: ${suggestedZone.zoneName}`}
                >
                  <span className="absolute -inset-3 animate-ping rounded-full bg-amber-300/60" />
                  <span className="relative block h-4 w-4 rounded-full border-2 border-white bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                </div>
              )}
            </div>
            <div className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3">
              <p className="text-xs text-amber-200/65">
                {t.minimap.nearestLocation}
              </p>
              <p className="mt-1 font-medium text-amber-50">
                {currentZone?.zoneName ?? t.minimap.unknownLocation}
              </p>
              {suggestedZone && (
                <p className="mt-2 text-sm text-amber-300">
                  {t.minimap.nextSuggestion} {suggestedItemName ? `${suggestedItemName} (${suggestedZone.zoneName})` : suggestedZone.zoneName}
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-white/[0.04] px-4 py-6 text-center text-amber-100/70">
            {t.minimap.notAvailable}
          </p>
        )}
      </div>
    </div>
  );
}
