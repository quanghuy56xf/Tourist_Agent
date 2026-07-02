"use client";

import type { ReactNode } from "react";

export default function VisitorBottomSheet({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-bottom-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-[2rem] border border-amber-200/15 bg-[#0b1328] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-amber-50 shadow-[0_-18px_50px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom-8 duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-amber-200/25" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="artifact-section-label mb-1">Product Eval</p>
            <h2 id="visitor-bottom-sheet-title" className="font-display text-xl text-amber-100">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-amber-200/20 bg-white/[0.06] text-amber-100/75 transition-colors hover:bg-white/[0.1] hover:text-amber-100"
            aria-label="Đóng"
            title="Đóng"
          >
            ×
          </button>
        </div>
        {description && (
          <p className="mb-4 text-sm leading-relaxed text-amber-100/70">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
