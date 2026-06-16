"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import ResultModal from "@/components/ResultModal";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import ScanViewfinderFrame from "@/components/visitor/ScanViewfinderFrame";
import LanguageSelector from "@/components/LanguageSelector";
import { SearchResponse, searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { buildSearchTrackingContext, readStoredGroupId } from "@/lib/visitorAnalytics";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type ScanPhase = "idle" | "scanning" | "found";

export default function SearchPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const methodPath = useGroupPath("/method");
  const { t } = useVisitorLocale();
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const startProgress = () => {
    stopProgress();
    setScanProgress(0);
    progressTimer.current = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 8 + 4;
      });
    }, 80);
  };

  useEffect(() => () => stopProgress(), []);

  const resetScan = () => {
    stopProgress();
    setErrorMsg(null);
    setSearchResult(null);
    setScanPhase("idle");
    setScanProgress(0);
    setFrozen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
  };

  const handleCapture = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setFrozen(true);
    setScanPhase("scanning");
    setErrorMsg(null);
    setSearchResult(null);
    startProgress();

    try {
      const file = new File([blob], "search.jpg", { type: "image/jpeg" });
      const compressed = await compressImage(file);
      const response = await searchObject(
        compressed,
        buildSearchTrackingContext(readStoredGroupId() ?? undefined)
      );

      stopProgress();
      setScanProgress(100);

      if (response.found && response.results.length > 0) {
        setScanPhase("found");
        const bestMatch = response.results[0];
        setTimeout(() => {
          router.push(
            `${groupPath(groupSlug, `/item/${bestMatch.item_id}`)}?similarity=${bestMatch.similarity}`
          );
        }, 900);
        return;
      }

      if (response.results.length > 0) {
        setSearchResult(response);
        setScanPhase("idle");
        setFrozen(false);
        URL.revokeObjectURL(url);
        setCapturedUrl(null);
        return;
      }

      setErrorMsg(response.message || t.scan.noMatch);
      URL.revokeObjectURL(url);
      setCapturedUrl(null);
      setFrozen(false);
      setScanPhase("idle");
      stopProgress();
      setScanProgress(0);
    } catch {
      setErrorMsg(t.scan.searchError);
      URL.revokeObjectURL(url);
      setCapturedUrl(null);
      setFrozen(false);
      setScanPhase("idle");
      stopProgress();
      setScanProgress(0);
    }
  };

  const closeResults = () => {
    setSearchResult(null);
    resetScan();
  };

  return (
    <div className="artifact-shell min-h-screen">
      <header
        className="px-6 pb-4 pt-8"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HomeButton />
            <BackButton onClick={() => router.push(methodPath)} label={t.common.back} variant="dark" />
          </div>
          <LanguageSelector compact />
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)" }}
          >
            <span style={{ color: "var(--primary-foreground)" }}>✦</span>
          </div>
          <span className="artifact-section-label">{t.scan.brand}</span>
        </div>
        <h1 className="font-display mt-3 text-xl">{t.scan.headline}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.scan.instruction}
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
        <ScanViewfinderFrame
          scanning={scanPhase === "scanning"}
          scanProgress={scanProgress}
          found={scanPhase === "found"}
        >
          <CameraCapture
            layout="inline"
            onCapture={handleCapture}
            frozen={frozen}
            capturedUrl={capturedUrl}
          />
        </ScanViewfinderFrame>

        {errorMsg && (
          <div
            className="w-full max-w-xs rounded-xl px-4 py-3 text-center text-sm"
            style={{
              background: "rgba(212,24,61,0.15)",
              border: "1px solid rgba(212,24,61,0.35)",
              color: "#f0e8d5",
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={() => document.getElementById("camera-capture-btn")?.click()}
          disabled={scanPhase !== "idle"}
          className="artifact-btn-primary w-full max-w-xs disabled:opacity-50"
        >
          {scanPhase === "scanning" ? (
            <>⟳ {t.scan.scanning}</>
          ) : scanPhase === "found" ? (
            <>✦ {t.results.found}</>
          ) : (
            <>📷 {t.scan.capture}</>
          )}
        </button>
      </div>

      {searchResult && (
        <ResultModal
          found={searchResult.found}
          results={searchResult.results.slice(0, 3)}
          message={searchResult.message}
          onClose={closeResults}
        />
      )}
    </div>
  );
}
