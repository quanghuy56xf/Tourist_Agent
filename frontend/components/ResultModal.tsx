"use client";

import { SearchMatch, resolveImageUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { groupPath } from "@/lib/groupSlug";
import { useGroupSlug } from "@/lib/useGroupPath";

interface ResultModalProps {
  found: boolean;
  results: SearchMatch[];
  message?: string;
  onClose: () => void;
}

function SimilarityBadge({
  value,
  isBest,
  matchLabel,
}: {
  value: number;
  isBest: boolean;
  matchLabel: string;
}) {
  const pct = (value * 100).toFixed(1);
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: isBest ? "var(--primary)" : "var(--secondary)",
        color: isBest ? "var(--primary-foreground)" : "var(--muted-foreground)",
        border: "1px solid var(--border)",
      }}
    >
      {pct}% {matchLabel}
    </span>
  );
}

export default function ResultModal({
  found,
  results,
  message,
  onClose,
}: ResultModalProps) {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const { t } = useVisitorLocale();
  const hasResults = results.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(14,11,7,0.7)" }}
    >
      <div className="artifact-card max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
        <h2 className="font-display mb-1 text-xl" style={{ color: found ? "var(--primary)" : "var(--foreground)" }}>
          {found ? t.results.found : hasResults ? t.results.suggestions : t.results.notFound}
        </h2>
        {message && (
          <p className="mb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {message}
          </p>
        )}

        {hasResults ? (
          <div className="mt-3 space-y-3">
            <p className="artifact-section-label">
              Top {results.length} {t.results.topMatches}
            </p>
            {results.map((item, index) => {
              const imgSrc = resolveImageUrl(item.image_url);
              return (
                <div key={item.item_id} className="artifact-card flex gap-3 p-3">
                  <div
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl"
                    style={{ background: "var(--secondary)" }}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs">{t.common.noImage}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold leading-tight">{item.name}</h3>
                      <SimilarityBadge
                        value={item.similarity}
                        isBest={index === 0 && found}
                        matchLabel={t.results.match}
                      />
                    </div>
                    <p className="mb-2 line-clamp-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {item.description}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(groupPath(groupSlug, `/item/${item.item_id}`))}
                      className="artifact-btn-primary px-3 py-1.5 text-xs"
                    >
                      ✨ {t.results.explore}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {message || t.results.noSimilar}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl py-3 text-sm font-medium"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          {t.common.close}
        </button>
      </div>
    </div>
  );
}
