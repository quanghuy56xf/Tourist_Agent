"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import HomeButton from "@/components/visitor/HomeButton";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useGroupPath } from "@/lib/useGroupPath";
import { loadTourById, ResolvedTour, tourTitle } from "@/lib/tours";

export default function TourCompletePage() {
  const params = useParams();
  const router = useRouter();
  const tourListPath = useGroupPath("/tour");
  const methodPath = useGroupPath("/method");
  const tourId = String(params.id);
  const { locale, t } = useVisitorLocale();
  const [tour, setTour] = useState<ResolvedTour | null>(null);

  useEffect(() => {
    loadTourById(tourId).then(setTour);
  }, [tourId]);

  const count = tour?.stops.length ?? 0;
  const summary = t.tour.completeSummary.replace("{count}", String(count));

  return (
    <main className="artifact-shell-pad relative flex flex-1 flex-col items-center justify-center text-center w-full">
      <div className="absolute left-4 top-4">
        <HomeButton />
      </div>
      <div
        className="mb-6 flex h-24 w-24 items-center justify-center rounded-full text-4xl"
        style={{
          background: "rgba(201,168,76,0.15)",
          border: "2px solid var(--primary)",
          boxShadow: "0 0 40px rgba(201,168,76,0.25)",
        }}
      >
        ✦
      </div>
      <h1 className="font-display text-3xl" style={{ color: "var(--primary)" }}>
        {t.tour.completeTitle}
      </h1>
      <p className="mt-3 text-lg font-medium">{t.tour.completeMessage}</p>
      {tour && (
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {tourTitle(tour, locale)}
        </p>
      )}
      <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
        {summary}
      </p>

      <div className="mt-10 w-full max-w-xs space-y-3">
        <button
          type="button"
          onClick={() => router.push(tourListPath)}
          className="artifact-btn-primary w-full"
        >
          {t.tour.backToTours}
        </button>
        <button
          type="button"
          onClick={() => router.push(methodPath)}
          className="w-full rounded-2xl py-3 text-sm"
          style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
        >
          {t.tour.backToMethod}
        </button>
      </div>
    </main>
  );
}
