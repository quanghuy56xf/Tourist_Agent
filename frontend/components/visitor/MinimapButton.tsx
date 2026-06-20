"use client";

import { useCallback, useEffect, useState } from "react";
import { useGroupSlug } from "@/lib/useGroupPath";
import {
  hasUnreadMinimap,
  markMinimapSeen,
  MINIMAP_UPDATED_EVENT,
} from "@/lib/minimapConfig";
import MinimapModal from "./MinimapModal";

export default function MinimapButton() {
  const groupSlug = useGroupSlug();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    setUnread(hasUnreadMinimap(groupSlug));

    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ groupSlug?: string }>).detail;
      if (detail?.groupSlug === groupSlug) setUnread(true);
    };

    window.addEventListener(MINIMAP_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(MINIMAP_UPDATED_EVENT, handleUpdate);
  }, [groupSlug]);

  const handleOpen = useCallback(() => {
    markMinimapSeen(groupSlug);
    setUnread(false);
    setOpen(true);
  }, [groupSlug]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-phone px-4">
        <button
          type="button"
          onClick={handleOpen}
          className="pointer-events-auto relative grid h-12 w-12 place-items-center rounded-full border border-amber-300/40 bg-[#251b0e]/95 text-amber-300 shadow-lg shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-[#332614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          aria-label="Mở bản đồ tham quan"
          title="Bản đồ tham quan"
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
              aria-label="Có vị trí mới trên bản đồ"
            />
          )}
        </button>
      </div>
      <MinimapModal open={open} onClose={() => setOpen(false)} groupSlug={groupSlug} />
    </>
  );
}