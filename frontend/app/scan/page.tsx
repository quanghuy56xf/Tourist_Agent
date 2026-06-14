"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import ResultModal from "@/components/ResultModal";
import BackButton from "@/components/visitor/BackButton";
import ScanViewfinderFrame from "@/components/visitor/ScanViewfinderFrame";
import LanguageSelector from "@/components/LanguageSelector";
import { SearchResponse, searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type ScanPhase = "idle" | "scanning" | "found";

export default function SearchPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const capturedUrlRef = useRef<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const revokeCapturedUrl = useCallback(() => {
    if (capturedUrlRef.current) {
      URL.revokeObjectURL(capturedUrlRef.current);
      capturedUrlRef.current = null;
    }
  }, []);

  const clearCapturedUrl = useCallback(() => {
    revokeCapturedUrl();
    setCapturedUrl(null);
  }, [revokeCapturedUrl]);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    stopProgress();
    setScanProgress(0);
    progressTimer.current = setInterval(() => {
      setScanProgress((previous) =>
        previous >= 95 ? previous : previous + Math.random() * 8 + 4
      );
    }, 80);
  }, [stopProgress]);

  useEffect(
    () => () => {
      stopProgress();
      revokeCapturedUrl();
    },
    [revokeCapturedUrl, stopProgress]
  );

  const resetScan = useCallback(() => {
    stopProgress();
    setScanPhase("idle");
    setScanProgress(0);
    setFrozen(false);
    clearCapturedUrl();
  }, [clearCapturedUrl, stopProgress]);

  const handleCapture = async (blob: Blob) => {
    clearCapturedUrl();
    const url = URL.createObjectURL(blob);
    capturedUrlRef.current = url;
    setCapturedUrl(url);
    setFrozen(true);
    setScanPhase("scanning");
    setErrorMsg(null);
    setSearchResult(null);
    startProgress();

    try {
      const file = new File([blob], "search.jpg", { type: "image/jpeg" });
      const compressed = await compressImage(file);
      const response = await searchObject(compressed);

      stopProgress();
      setScanProgress(100);

      if (response.found && response.results.length > 0) {
        setScanPhase("found");
        const bestMatch = response.results[0];
        setTimeout(() => {
          router.push(
            `/item/${bestMatch.item_id}?similarity=${bestMatch.similarity}`
          );
        }, 900);
        return;
      }

      if (response.results.length > 0) {
        setSearchResult(response);
        resetScan();
      } else {
        setErrorMsg(response.message || t.scan.noMatch);
        resetScan();
      }
    } catch {
      setErrorMsg(t.scan.searchError);
      resetScan();
    }
  };

  const resetCamera = () => {
    setErrorMsg(null);
    setSearchResult(null);
    resetScan();
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
        <div className="mb-4 flex items-center justify-between">
          <BackButton onClick={() => router.push("/method")} label={t.common.back} variant="dark" />
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
