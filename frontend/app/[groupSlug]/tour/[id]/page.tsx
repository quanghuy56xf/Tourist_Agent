"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import TourStopCard from "@/components/visitor/TourStopCard";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import {
  getTourProgress,
  loadTourById,
  resetTourProgress,
  ResolvedTour,
  tourDescription,
  tourTitle,
} from "@/lib/tours";

export default function TourDetailPage() {
  const params = useParams();
  const tourId = String(params.id);
  const groupSlug = useGroupSlug();
  const tourListPath = useGroupPath("/tour");
  const router = useRouter();
  const { locale, t } = useVisitorLocale();
  const [tour, setTour] = useState<ResolvedTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(getTourProgress(tourId));

  useEffect(() => {
    loadTourById(tourId)
      .then(setTour)
      .finally(() => setLoading(false));
  }, [tourId]);

  useEffect(() => {
    setProgress(getTourProgress(tourId));
  }, [tourId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <p className="mb-4" style={{ color: "var(--primary)" }}>
          {t.tour.empty}
        </p>
        <BackButton onClick={() => router.push(tourListPath)} label={t.common.back} />
      </div>
    );
  }

  const total = tour.stops.length;
  const done = progress.completedItemIds.length;
  const finished = done >= total;
  const actionLabel = finished ? t.tour.restart : done > 0 ? t.tour.continue : t.tour.start;

  const handleStart = () => {
    if (finished) resetTourProgress(tourId);
    router.push(groupPath(groupSlug, `/tour/${tourId}/play`));
  };

  return (
    <div className="artifact-shell min-h-screen pb-8">
      <header className="px-6 pb-4 pt-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={() => router.push(tourListPath)} label={t.common.back} />
        </div>
        <h1 className="font-display text-xl">{tourTitle(tour, locale)}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {tourDescription(tour, locale)}
        </p>
        <p className="mt-3 text-xs" style={{ color: "var(--primary)" }}>
          {t.tour.progress}: {done}/{total}
        </p>
      </header>

      <div className="space-y-2 p-4">
        {tour.stops.map((stop, index) => {
          const completed = progress.completedItemIds.includes(stop.itemId);
          const isCurrent = !finished && index === progress.currentStep;
          return (
            <TourStopCard
              key={stop.itemId}
              stop={stop}
              index={index}
              completed={completed}
              isCurrent={isCurrent}
              stopLabel={t.tour.stopLabel}
              hintLabel={t.tour.stopHint}
              showDetailsLabel={t.tour.showDetails}
              hideDetailsLabel={t.tour.hideDetails}
              noDescriptionLabel={t.tour.noDescription}
              noImageLabel={t.common.noImage}
              locale={locale}
            />
          );
        })}
      </div>

      <div className="px-4">
        {finished ? (
          <button
            type="button"
            onClick={() => router.push(groupPath(groupSlug, `/tour/${tourId}/complete`))}
            className="artifact-btn-primary mb-3 w-full"
          >
            ✦ {t.tour.completeTitle}
          </button>
        ) : null}
        <button type="button" onClick={handleStart} className="artifact-btn-primary w-full">
          {actionLabel} →
        </button>
      </div>
    </div>
  );
}
