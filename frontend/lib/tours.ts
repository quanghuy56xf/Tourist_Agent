import {
  fetchApi,
  getGroupItems,
  getTour,
  GroupItem,
  listGroups,
  listTours,
  resolveImageUrl,
  TourDetail,
} from "@/lib/api";

import type { VisitorLocale } from "@/lib/i18n";

export type TourStop = {
  itemId: number;
  name: string;
  description: string;
  hintVi: string;
  hintEn: string;
  imageUrl: string | null;
};

export type ResolvedTour = {
  id: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  stops: TourStop[];
};

export type TourProgress = {
  completedItemIds: number[];
  currentStep: number;
  completedAt?: string;
};

const PROGRESS_PREFIX = "hera_tour_progress_";

function mapApiTour(detail: TourDetail): ResolvedTour {
  return {
    id: `tour-${detail.id}`,
    titleVi: detail.title_vi,
    titleEn: detail.title_en,
    descriptionVi: detail.description_vi,
    descriptionEn: detail.description_en,
    stops: detail.stops.map((stop) => ({
      itemId: stop.item_id,
      name: stop.name,
      description: stop.description,
      hintVi: stop.hint_vi,
      hintEn: stop.hint_en,
      imageUrl: resolveImageUrl(stop.image_url),
    })),
  };
}

function toStop(item: GroupItem): TourStop {
  return {
    itemId: item.id,
    name: item.name,
    description: item.description?.trim() || "",
    hintVi: "",
    hintEn: "",
    imageUrl: resolveImageUrl(item.main_image_url),
  };
}

async function loadLegacyTours(groupId?: number): Promise<ResolvedTour[]> {
  if (groupId != null) {
    try {
      const data = await getGroupItems(groupId);
      if (data.items.length < 2) return [];
      return [
        {
          id: `group-${groupId}`,
          titleVi: `Tour ${data.group_name}`,
          titleEn: `${data.group_name} Tour`,
          descriptionVi: `Khám phá ${data.items.length} hiện vật theo thứ tự trong khu di tích.`,
          descriptionEn: `Explore ${data.items.length} objects in order across this heritage site.`,
          stops: data.items.map(toStop),
        },
      ];
    } catch {
      return [];
    }
  }

  const tours: ResolvedTour[] = [];
  const seen = new Set<string>();

  try {
    const groups = await listGroups();
    for (const group of groups) {
      if (group.item_count < 2) continue;
      const data = await getGroupItems(group.id);
      if (data.items.length < 2) continue;
      const id = `group-${group.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      tours.push({
        id,
        titleVi: `Tour ${group.name}`,
        titleEn: `${group.name} Tour`,
        descriptionVi: `Khám phá ${data.items.length} hiện vật theo thứ tự trong khu di tích.`,
        descriptionEn: `Explore ${data.items.length} objects in order across this heritage site.`,
        stops: data.items.map(toStop),
      });
    }
  } catch {
    /* optional */
  }

  try {
    const all = await fetchApi("/api/objects/all");
    const items: GroupItem[] = all.items ?? [];
    if (items.length >= 2) {
      const featuredStops = items.slice(0, Math.min(5, items.length)).map(toStop);
      tours.unshift({
        id: "featured",
        titleVi: "Tour khám phá nổi bật",
        titleEn: "Featured exploration tour",
        descriptionVi: `Lộ trình gợi ý qua ${featuredStops.length} hiện vật tiêu biểu.`,
        descriptionEn: `A suggested route through ${featuredStops.length} highlight objects.`,
        stops: featuredStops,
      });
    }
  } catch {
    /* ignore */
  }

  return tours;
}

export async function loadSuggestedTours(groupId?: number): Promise<ResolvedTour[]> {
  try {
    const summaries = await listTours(true, groupId);
    if (summaries.length > 0) {
      const details = await Promise.all(summaries.map((summary) => getTour(summary.id)));
      return details.map(mapApiTour);
    }
  } catch {
    /* fallback below */
  }
  return loadLegacyTours(groupId);
}

export async function loadTourById(tourId: string): Promise<ResolvedTour | null> {
  if (tourId.startsWith("tour-")) {
    const numericId = Number(tourId.slice(5));
    if (!Number.isFinite(numericId)) return null;
    try {
      const detail = await getTour(numericId);
      return mapApiTour(detail);
    } catch {
      return null;
    }
  }
  const tours = await loadLegacyTours();
  return tours.find((t) => t.id === tourId) ?? null;
}

export function getTourProgress(tourId: string): TourProgress {
  if (typeof window === "undefined") {
    return { completedItemIds: [], currentStep: 0 };
  }
  try {
    const raw = localStorage.getItem(`${PROGRESS_PREFIX}${tourId}`);
    if (!raw) return { completedItemIds: [], currentStep: 0 };
    return JSON.parse(raw) as TourProgress;
  } catch {
    return { completedItemIds: [], currentStep: 0 };
  }
}

export function saveTourProgress(tourId: string, progress: TourProgress): void {
  localStorage.setItem(`${PROGRESS_PREFIX}${tourId}`, JSON.stringify(progress));
}

export function resetTourProgress(tourId: string): void {
  localStorage.removeItem(`${PROGRESS_PREFIX}${tourId}`);
}

export function markStopComplete(
  tourId: string,
  itemId: number,
  totalStops: number
): { finished: boolean; progress: TourProgress } {
  const progress = getTourProgress(tourId);
  if (!progress.completedItemIds.includes(itemId)) {
    progress.completedItemIds.push(itemId);
  }
  progress.currentStep = Math.min(progress.completedItemIds.length, totalStops);
  if (progress.currentStep >= totalStops) {
    progress.completedAt = new Date().toISOString();
  }
  saveTourProgress(tourId, progress);
  return { finished: progress.currentStep >= totalStops, progress };
}

export function tourTitle(tour: ResolvedTour, locale: VisitorLocale): string {
  if (locale === "vi") return tour.titleVi;
  return tour.titleEn;
}

export function tourDescription(tour: ResolvedTour, locale: VisitorLocale): string {
  if (locale === "vi") return tour.descriptionVi;
  return tour.descriptionEn;
}

export function stopHint(stop: TourStop, locale: VisitorLocale): string {
  const hint = locale === "vi" ? stop.hintVi : stop.hintEn;
  if (hint.trim()) return hint;
  return stop.description;
}
