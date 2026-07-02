"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import ResultModal from "@/components/ResultModal";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import ScanViewfinderFrame from "@/components/visitor/ScanViewfinderFrame";
import LanguageSelector from "@/components/LanguageSelector";
import type { SearchResponse } from "@/lib/api/search";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { useObjectSearch } from "@/lib/useObjectSearch";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type ScanPhase = "idle" | "scanning" | "found";

export default function SearchPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const methodPath = useGroupPath("/method");
  const { t } = useVisitorLocale();
  const { searchImage } = useObjectSearch();
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setFrozen(true);
    setScanPhase("scanning");
    setErrorMsg(null);
    setSearchResult(null);
    startProgress();

    try {
      const response = await searchImage(blob);

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

  const handleUploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || scanPhase !== "idle") return;
    void handleCapture(file);
  };

  return (
    <main className="flex flex-1 flex-col w-full">
      <header className="artifact-page-head pb-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HomeButton />
            <BackButton onClick={() => router.push(methodPath)} label={t.common.back} variant="dark" />
          </div>
          <LanguageSelector compact />
        </div>
        <p className="text-center text-sm font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>
          {t.scan.instruction}
        </p>
      </header>

      <div className="artifact-page-body flex flex-1 flex-col items-center justify-center pb-24 sm:pb-32 gap-6">
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

        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            onClick={() => document.getElementById("camera-capture-btn")?.click()}
            disabled={scanPhase !== "idle"}
            className="artifact-btn-primary w-full disabled:opacity-50"
          >
            {scanPhase === "scanning" ? (
              <>⟳ {t.scan.scanning}</>
            ) : scanPhase === "found" ? (
              <>✦ {t.results.found}</>
            ) : (
              <>📷 {t.scan.capture}</>
            )}
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadImage}
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={scanPhase !== "idle"}
            className="w-full rounded-full border border-amber-300/35 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-amber-100 transition-colors hover:bg-white/[0.1] disabled:opacity-50"
          >
            🖼️ {t.companion.uploadImage}
          </button>
        </div>
      </div>

      {searchResult && (
        <ResultModal
          found={searchResult.found}
          results={searchResult.results.slice(0, 3)}
          message={searchResult.message}
          onClose={closeResults}
        />
      )}
    </main>
  );
}
