"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { groupPath } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { readStoredGroupId } from "@/lib/visitorAnalytics";
import {
  getTourProgress,
  loadSuggestedTours,
  ResolvedTour,
  tourDescription,
  tourTitle,
} from "@/lib/tours";

export default function TourListPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const methodPath = useGroupPath("/method");
  const { locale, t } = useVisitorLocale();
  const [tours, setTours] = useState<ResolvedTour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groupId = readStoredGroupId() ?? undefined;
    loadSuggestedTours(groupId)
      .then(setTours)
      .finally(() => setLoading(false));
  }, [groupSlug]);

  return (
    <div className="artifact-shell min-h-screen">
      <header className="artifact-page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={() => router.push(methodPath)} label={t.common.back} />
        </div>
        <p className="artifact-section-label mb-1">{t.productName}</p>
        <h1 className="font-display text-xl">{t.tour.pageTitle}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.tour.pageSubtitle}
        </p>
      </header>

      <div className="flex-1 p-4">
        <button
          type="button"
          onClick={() => router.push(groupPath(groupSlug, "/tour-match"))}
          className="artifact-btn-primary w-full mb-4 flex items-center justify-center gap-2 font-bold py-3 text-sm active:scale-95"
          style={{
            background: "rgba(201, 168, 76, 0.12)",
            border: "1px solid var(--primary)",
            color: "var(--primary)",
            minHeight: "0px",
          }}
        >
          ⚔ Thi Đấu Trực Tuyến (Tạo Room)
        </button>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
        ) : tours.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            {t.tour.empty}
          </p>
        ) : (
          <div className="space-y-3">
            {tours.map((tour) => {
              const progress = getTourProgress(tour.id);
              const done = progress.completedItemIds.length;
              const total = tour.stops.length;
              const finished = done >= total && total > 0;
              return (
                <button
                  key={tour.id}
                  type="button"
                  onClick={() => router.push(groupPath(groupSlug, `/tour/${tour.id}`))}
                  className="artifact-card w-full p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-bold">{tourTitle(tour, locale)}</h2>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {tourDescription(tour, locale)}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: finished ? "var(--primary)" : "var(--secondary)",
                        color: finished ? "var(--primary-foreground)" : "var(--muted-foreground)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {total} {t.tour.stops}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--secondary)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${total ? (done / total) * 100 : 0}%`,
                        background: "var(--primary)",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "var(--primary)" }}>
                    {finished
                      ? t.tour.completed
                      : done > 0
                        ? `${t.tour.progress}: ${done}/${total}`
                        : t.tour.start}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
