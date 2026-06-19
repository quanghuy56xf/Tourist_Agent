"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import LoadingOverlay from "@/components/LoadingOverlay";
import ResultModal from "@/components/ResultModal";
import type { SearchResponse } from "@/lib/api/search";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { useObjectSearch } from "@/lib/useObjectSearch";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import LanguageSelector from "@/components/LanguageSelector";
import PersonaSelector from "@/components/PersonaSelector";

const methods = [
  { id: "camera", icon: "📸", titleKey: "cameraTitle" as const, subKey: "cameraSubtitle" as const },
  { id: "upload", icon: "🖼️", titleKey: "uploadTitle" as const, subKey: "uploadSubtitle" as const },
  { id: "tour", icon: "🗺️", titleKey: "tourTitle" as const, subKey: "tourSubtitle" as const },
];

export default function MethodSelectionPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const scanPath = useGroupPath("/scan");
  const tourPath = useGroupPath("/tour");
  const { t } = useVisitorLocale();
  const { searchImage } = useObjectSearch();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setErrorMsg(null);
    setSearchResult(null);
    try {
      const response = await searchImage(e.target.files[0]);
      if (response.found && response.results.length > 0) {
        router.push(
          `${groupPath(groupSlug, `/item/${response.results[0].item_id}`)}?similarity=${response.results[0].similarity}`
        );
      } else if (response.results.length > 0) {
        setSearchResult(response);
      } else {
        setErrorMsg(response.message || t.method.noMatch);
      }
    } catch {
      setErrorMsg(t.method.uploadError);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const handleClick = (id: string) => {
    if (id === "camera") router.push(scanPath);
    else if (id === "upload") document.getElementById("file-upload")?.click();
    else if (id === "tour") router.push(tourPath);
  };

  return (
    <main className="flex flex-1 flex-col w-full">
      <header className="artifact-page-head">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => router.push("/")} label={t.common.back} />
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector compact />
            </div>
          </div>
          <div className="w-full pt-1">
            <PersonaSelector />
          </div>
        </div>

        <div className="mb-1 flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)" }}
          >
            <span style={{ color: "var(--primary-foreground)" }}>✦</span>
          </div>
          <span className="artifact-section-label">{t.productName}</span>
        </div>
        <h1 className="font-display mt-3 text-2xl">
          {t.method.titleLine1}
          <br />
          {t.method.titleLine2}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.method.subtitle}
        </p>
      </header>

      <div className="artifact-page-body flex-1 space-y-3">
        {errorMsg && (
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "rgba(212,24,61,0.15)", border: "1px solid rgba(212,24,61,0.3)" }}
          >
            {errorMsg}
          </div>
        )}

        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleClick(m.id)}
            className="artifact-card flex w-full items-center gap-4 p-5 text-left transition-transform active:scale-[0.98]"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
              style={{ background: "var(--secondary)" }}
            >
              {m.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold">{t.method[m.titleKey]}</h3>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t.method[m.subKey]}
              </p>
            </div>
          </button>
        ))}
      </div>

      <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {loading && <LoadingOverlay />}
      {searchResult && (
        <ResultModal
          found={searchResult.found}
          results={searchResult.results.slice(0, 3)}
          message={searchResult.message}
          onClose={() => setSearchResult(null)}
        />
      )}
    </main>
  );
}
