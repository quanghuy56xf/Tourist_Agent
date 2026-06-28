"use client";

import { useEffect, useState } from "react";

export type DiscoveryImage = {
  url: string;
  alt?: string;
};

type CompanionDiscoveryCardProps = {
  open: boolean;
  itemName: string;
  confidence?: number | null;
  description?: string | null;
  images?: DiscoveryImage[];
  hook?: string;
  labels: {
    found: string;
    confidenceHigh: string;
    confidenceMedium: string;
    tellStory: string;
    challenge: string;
    slideshow: string;
    showMap: string;
    close: string;
    imageAlt: string;
  };
  onTellStory: () => void;
  onStartChallenge: () => void;
  onShowMap: () => void;
  onClose: () => void;
};

function formatConfidence(confidence?: number | null): string | null {
  if (confidence == null || Number.isNaN(confidence)) return null;
  const normalized = confidence <= 1 ? confidence * 100 : confidence;
  if (normalized <= 0) return null;
  return `${Math.round(normalized)}%`;
}

export default function CompanionDiscoveryCard({
  open,
  itemName,
  confidence,
  images = [],
  hook,
  labels,
  onTellStory,
  onStartChallenge,
  onShowMap,
  onClose,
}: CompanionDiscoveryCardProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const image = images[activeImageIndex];
  const confidenceText = formatConfidence(confidence);

  useEffect(() => {
    if (open) {
      setActiveImageIndex(0);
      setSlideshowOpen(false);
    }
  }, [open, itemName]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-end justify-center bg-black/55 px-4 pb-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#111a33]/95 text-amber-50 shadow-[0_24px_80px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom-8 duration-300">
        <div className="relative h-56 overflow-hidden bg-gradient-to-br from-amber-500/20 via-blue-900/40 to-black">
          {image ? (
            <img
              src={image.url}
              alt={image.alt || labels.imageAlt.replace("{name}", itemName)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-7xl">🏛️</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111a33] via-[#111a33]/20 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
            aria-label={labels.close}
          >
            ×
          </button>
          {images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${index === activeImageIndex ? "w-6 bg-amber-300" : "w-1.5 bg-white/45"}`}
                  aria-label={`${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 px-5 pb-5 pt-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
              <span>✨</span>
              {labels.found}
            </div>
            <h3 className="font-serif text-2xl font-semibold leading-tight text-amber-100">
              {itemName}
            </h3>
            <p className="text-sm leading-6 text-amber-50/75">
              {hook}
            </p>
            {confidenceText && (
              <p className="text-xs text-amber-200/60">
                {labels.confidenceHigh} · {confidenceText}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onTellStory}
              className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.25)] transition-transform active:scale-95"
            >
              🎧 {labels.tellStory}
            </button>
            <button
              type="button"
              onClick={onStartChallenge}
              className="rounded-2xl border border-amber-300/30 bg-white/[0.07] px-4 py-3 text-sm font-bold text-amber-100 transition-colors hover:bg-white/[0.11] active:scale-95"
            >
              🧩 {labels.challenge}
            </button>
            <button
              type="button"
              onClick={() => setSlideshowOpen(true)}
              className="rounded-2xl border border-sky-300/30 bg-sky-400/10 px-4 py-3 text-sm font-bold text-sky-100 transition-colors hover:bg-sky-400/15 active:scale-95"
            >
              🖼️ {labels.slideshow}
            </button>
            <button
              type="button"
              onClick={onShowMap}
              className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100 transition-colors hover:bg-emerald-400/15 active:scale-95"
            >
              🗺️ {labels.showMap}
            </button>
          </div>
        </div>
      </div>

      {slideshowOpen && (
        <div className="absolute inset-0 z-[70] flex flex-col bg-black/95 p-4 text-white animate-in fade-in duration-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-amber-100">{itemName}</p>
              <p className="text-xs text-white/50">
                {activeImageIndex + 1}/{Math.max(images.length, 1)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSlideshowOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-xl text-white/80"
              aria-label={labels.close}
            >
              ×
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            {image ? (
              <img
                src={image.url}
                alt={image.alt || labels.imageAlt.replace("{name}", itemName)}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-8xl">🏛️</div>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveImageIndex((current) => (current - 1 + images.length) % images.length)}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold"
              >
                ‹
              </button>
              <div className="flex gap-1.5">
                {images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${index === activeImageIndex ? "w-7 bg-amber-300" : "w-2 bg-white/35"}`}
                    aria-label={`${index + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setActiveImageIndex((current) => (current + 1) % images.length)}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold"
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
