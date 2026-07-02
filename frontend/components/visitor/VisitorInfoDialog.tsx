"use client";

import type { ReactNode } from "react";

export default function VisitorInfoDialog({
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-info-dialog-title"
      onClick={onClose}
    >
      <div
        className="artifact-card max-h-[88dvh] w-full max-w-phone overflow-y-auto p-4 sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="artifact-section-label mb-1">HERA</p>
            <h2 id="visitor-info-dialog-title" className="font-display text-xl text-amber-100">
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
