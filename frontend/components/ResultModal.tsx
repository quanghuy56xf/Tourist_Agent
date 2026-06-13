"use client";

import { SearchMatch, resolveImageUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

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
  const color = isBest
    ? "bg-green-900/40 text-green-400 border-green-700"
    : value >= 0.65
      ? "bg-yellow-900/30 text-yellow-400 border-yellow-700"
      : "bg-slate-800 text-slate-400 border-slate-600";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${color}`}>
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
  const { t } = useVisitorLocale();
  const hasResults = results.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`w-3 h-3 rounded-full ${found ? "bg-green-500" : hasResults ? "bg-yellow-500" : "bg-red-500"}`}
          />
          <h2
            className={`text-xl font-bold ${found ? "text-green-400" : hasResults ? "text-yellow-400" : "text-red-400"}`}
          >
            {found
              ? t.results.found
              : hasResults
                ? t.results.suggestions
                : t.results.notFound}
          </h2>
        </div>

        {message && (
          <p className="text-slate-400 text-sm mb-4">{message}</p>
        )}

        {hasResults ? (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Top {results.length} {t.results.topMatches}
            </p>
            {results.map((item, index) => {
              const imgSrc = resolveImageUrl(item.image_url);
              return (
                <div
                  key={item.item_id}
                  className={`flex gap-3 p-3 rounded-xl border ${
                    index === 0 && found
                      ? "border-green-700/50 bg-green-950/20"
                      : "border-slate-700 bg-slate-800/40"
                  }`}
                >
                  <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-slate-800 border border-slate-600">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        {t.common.noImage}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm leading-tight">
                        {index === 0 && found && (
                          <span className="text-green-400 mr-1">#1</span>
                        )}
                        {item.name}
                      </h3>
                      <SimilarityBadge
                        value={item.similarity}
                        isBest={index === 0 && found}
                        matchLabel={t.results.match}
                      />
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-2">
                      {item.description}
                    </p>
                    <button 
                      onClick={() => router.push(`/item/${item.item_id}`)}
                      className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors font-medium inline-flex items-center gap-1 shadow-lg shadow-blue-900/20"
                    >
                      <span>✨</span> {t.results.explore}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-300 text-sm mt-2">
            {message || t.results.noSimilar}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
        >
          {t.common.close}
        </button>
      </div>
    </div>
  );
}
