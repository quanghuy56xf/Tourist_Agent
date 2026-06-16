"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import ScanViewfinderFrame from "@/components/visitor/ScanViewfinderFrame";
import LanguageSelector from "@/components/LanguageSelector";
import { searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { groupPath } from "@/lib/groupSlug";
import { useGroupSlug } from "@/lib/useGroupPath";
import { buildSearchTrackingContext, readStoredGroupId } from "@/lib/visitorAnalytics";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import {
  getTourProgress,
  loadTourById,
  markStopComplete,
  ResolvedTour,
  tourTitle,
} from "@/lib/tours";

type ScanPhase = "idle" | "scanning" | "found";

const TOUR_MATCH_MIN = 0.55;

export default function TourPlayPage() {
  const params = useParams();
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const tourId = String(params.id);
  const { locale, t } = useVisitorLocale();

  const [tour, setTour] = useState<ResolvedTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = getTourProgress(tourId);
  const currentStep = Math.min(progress.currentStep, (tour?.stops.length ?? 1) - 1);
  const currentStop = tour?.stops[currentStep];

  useEffect(() => {
    loadTourById(tourId)
      .then((data) => {
        if (!data) return;
        setTour(data);
        const p = getTourProgress(tourId);
        if (p.currentStep >= data.stops.length) {
          router.replace(groupPath(groupSlug, `/tour/${tourId}/complete`));
        }
      })
      .finally(() => setLoading(false));
  }, [tourId, router, groupSlug]);

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
      setScanProgress((prev) => (prev >= 95 ? prev : prev + Math.random() * 8 + 4));
    }, 80);
  };

  useEffect(() => () => stopProgress(), []);

  const resetScan = () => {
    stopProgress();
    setErrorMsg(null);
    setScanPhase("idle");
    setScanProgress(0);
    setFrozen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
  };

  const handleCapture = async (blob: Blob) => {
    if (!currentStop || !tour) return;

    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setFrozen(true);
    setScanPhase("scanning");
    setErrorMsg(null);
    startProgress();

    try {
      const file = new File([blob], "tour-scan.jpg", { type: "image/jpeg" });
      const compressed = await compressImage(file);
      const response = await searchObject(
        compressed,
        buildSearchTrackingContext(readStoredGroupId() ?? undefined)
      );

      stopProgress();
      setScanProgress(100);

      const best = response.results[0];
      const expectedId = currentStop.itemId;
      const matched =
        best &&
        best.item_id === expectedId &&
        (response.found || best.similarity >= TOUR_MATCH_MIN);

      if (matched) {
        setScanPhase("found");
        const { finished } = markStopComplete(tourId, expectedId, tour.stops.length);
        setTimeout(() => {
          if (finished) {
            router.push(groupPath(groupSlug, `/tour/${tourId}/complete`));
          } else {
            router.push(
              `${groupPath(groupSlug, `/item/${expectedId}`)}?similarity=${best.similarity}&tour=${tourId}&step=${currentStep}`
            );
          }
        }, 900);
        return;
      }

      if (best && best.item_id !== expectedId) {
        setErrorMsg(`${t.tour.wrongStop} ${currentStop.name}`);
      } else {
        setErrorMsg(response.message || t.scan.noMatch);
      }

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

  if (loading || !tour || !currentStop) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const stepLabel = t.tour.stepOf
    .replace("{current}", String(currentStep + 1))
    .replace("{total}", String(tour.stops.length));

  return (
    <div className="artifact-shell min-h-screen">
      <header className="artifact-page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HomeButton />
            <BackButton
              onClick={() => router.push(groupPath(groupSlug, `/tour/${tourId}`))}
              label={t.common.back}
              variant="dark"
            />
          </div>
          <LanguageSelector compact />
        </div>
        <p className="artifact-section-label mb-1">{tourTitle(tour, locale)}</p>
        <h1 className="font-display text-lg">{t.tour.currentTarget}</h1>
        <p className="mt-1 text-sm font-bold" style={{ color: "var(--primary)" }}>
          {currentStop.name}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {stepLabel} · {t.tour.scanInstruction}
        </p>
      </header>

      <div className="artifact-page-body flex flex-1 flex-col items-center justify-center gap-6">
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
    </div>
  );
}
