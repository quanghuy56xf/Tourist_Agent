"use client";

import { useEffect, useMemo, useState } from "react";
import type { MinimapConfig } from "@/lib/api";
import {
  buildVisitorMapMarkers,
  resolveUserLocation,
  resolveZoneForItem,
} from "@/lib/minimapLayers";
import {
  MINIMAP_UPDATED_EVENT,
  readRememberedMinimapItem,
} from "@/lib/minimapState";
import HeritageMapCanvas from "@/components/visitor/HeritageMapCanvas";
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

  useEffect(() => {
    if (!open) return;

    const refresh = () => setLastItemId(readRememberedMinimapItem(groupSlug));
    refresh();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const handleMinimapUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ groupSlug?: string }>).detail;
      if (detail?.groupSlug === groupSlug) refresh();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(MINIMAP_UPDATED_EVENT, handleMinimapUpdate);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(MINIMAP_UPDATED_EVENT, handleMinimapUpdate);
    };
  }, [groupSlug, onClose, open]);

  const userLocation = useMemo(
    () => resolveUserLocation(config, groupSlug),
    [config, groupSlug, lastItemId]
  );
  const suggestedZone = resolveZoneForItem(config, suggestedItemId);
  const markers = useMemo(
    () =>
      buildVisitorMapMarkers(config, groupSlug, suggestedItemId, {
        currentLocationAria: (name) =>
          t.minimap.currentLocationAria.replace("{name}", name),
        suggestedLocationAria: (name) =>
          t.minimap.suggestedLocationAria.replace("{name}", name),
      }),
    [config, groupSlug, suggestedItemId, t.minimap, lastItemId]
  );

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
            <HeritageMapCanvas
              imageSrc={config.imageSrc}
              mapLabel={t.minimap.mapLabel}
              markers={markers}
            />
            <div className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3">
              <p className="text-xs text-amber-200/65">
                {t.minimap.nearestLocation}
              </p>
              <p className="mt-1 font-medium text-amber-50">
                {userLocation?.zone.zoneName ?? t.minimap.unknownLocation}
              </p>
              {suggestedZone && (
                <p className="mt-2 text-sm text-amber-300">
                  {t.minimap.nextSuggestion}{" "}
                  {suggestedItemName
                    ? `${suggestedItemName} (${suggestedZone.zoneName})`
                    : suggestedZone.zoneName}
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
