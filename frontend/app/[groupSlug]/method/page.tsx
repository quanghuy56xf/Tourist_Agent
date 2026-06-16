"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import LoadingOverlay from "@/components/LoadingOverlay";
import ResultModal from "@/components/ResultModal";
import { SearchResponse, searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { buildSearchTrackingContext, readStoredGroupId } from "@/lib/visitorAnalytics";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

const methods = [
  { id: "camera", icon: "📸", titleKey: "cameraTitle" as const, subKey: "cameraSubtitle" as const },
  { id: "upload", icon: "🖼️", titleKey: "uploadTitle" as const, subKey: "uploadSubtitle" as const },
  { id: "tour", icon: "🗺️", titleKey: "tourTitle" as const, subKey: "tourSubtitle" as const },
];

export default function MethodSelectionPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const groupHomePath = useGroupPath();
  const scanPath = useGroupPath("/scan");
  const tourPath = useGroupPath("/tour");
  const { t } = useVisitorLocale();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    setErrorMsg(null);
    setSearchResult(null);
    try {
      const compressed = await compressImage(e.target.files[0]);
      const response = await searchObject(
        compressed,
        buildSearchTrackingContext(readStoredGroupId() ?? undefined)
      );
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
    <div className="artifact-shell">
      <header className="px-6 pb-4 pt-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-6 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={() => router.push(groupHomePath)} label={t.common.back} />
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

      <div className="flex-1 space-y-3 px-6 py-8">
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
    </div>
  );
}
