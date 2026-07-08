"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getDynamicMinimapConfig } from "@/lib/api";
import type { MinimapConfig } from "@/lib/api";
import { VISITOR_GROUP_ID_KEY } from "@/lib/groupSlug";
import { useGroupSlug } from "@/lib/useGroupPath";
import {
  hasUnreadMinimap,
  markMinimapSeen,
  readMinimapSuggestion,
  MINIMAP_UPDATED_EVENT,
} from "@/lib/minimapState";
import MinimapModal from "./MinimapModal";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function MinimapButton() {
  const { t } = useVisitorLocale();
  const groupSlug = useGroupSlug();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [config, setConfig] = useState<MinimapConfig | null>(null);
  const [suggestedItemId, setSuggestedItemId] = useState<number | null>(null);

  const hideOnPage =
    pathname.includes("/tour") ||
    pathname.endsWith("/method") ||
    pathname.endsWith("/scan") ||
    pathname === `/${groupSlug}` ||
    pathname === `/${groupSlug}/` ||
    pathname === "/";
  const elevated = pathname.includes("/item/") && Boolean(searchParams.get("tour"));

  useEffect(() => {
    let cancelled = false;
    const groupId = Number(window.localStorage.getItem(VISITOR_GROUP_ID_KEY));
    if (!Number.isInteger(groupId) || groupId <= 0) {
      setConfig(null);
      return;
    }

    void getDynamicMinimapConfig(groupId)
      .then((nextConfig) => {
        if (!cancelled) setConfig(nextConfig);
      })
      .catch(() => {
        if (!cancelled) setConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [groupSlug]);

  useEffect(() => {
    setUnread(hasUnreadMinimap(groupSlug));
    setSuggestedItemId(readMinimapSuggestion(groupSlug));

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ groupSlug?: string }>).detail;
      if (detail?.groupSlug === groupSlug) {
        setUnread(true);
        setSuggestedItemId(readMinimapSuggestion(groupSlug));
      }
    };

    window.addEventListener(MINIMAP_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(MINIMAP_UPDATED_EVENT, handleUpdate);
  }, [groupSlug]);

  const handleOpen = useCallback(() => {
    markMinimapSeen(groupSlug);
    setUnread(false);
    setOpen(true);
  }, [groupSlug]);

  if (hideOnPage) return null;

  return (
    <>
      <div
        className={`pointer-events-none fixed left-1/2 z-40 w-full max-w-phone -translate-x-1/2 px-4 ${
          elevated
            ? "bottom-[calc(8.75rem+env(safe-area-inset-bottom))]"
            : "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleOpen}
            className="pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full border border-amber-300/40 bg-[#251b0e]/95 text-amber-300 shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-[#332614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label={t.minimap.openMap}
            title={t.minimap.title}
          >
            <svg
              viewBox="0 0 24 24"
              width="23"
              height="23"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z" />
              <path d="M8 3v15M16 6v15" />
            </svg>
            {unread && (
              <span
                className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#251b0e] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                aria-label={t.minimap.newLocation}
              />
            )}
          </button>
        </div>
      </div>
      <MinimapModal
        open={open}
        onClose={() => setOpen(false)}
        groupSlug={groupSlug}
        config={config}
        suggestedItemId={suggestedItemId}
      />
    </>
  );
}
