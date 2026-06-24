export const COMPANION_MODE_KEY = "hera_companion_mode";
export const COMPANION_INTRO_SEEN_KEY = "hera_companion_intro_seen";
export const VISITED_ITEMS_KEY = "hera_companion_visited_items";

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;

export function getVisitedItemIds(storage: ReadStorage): number[] {
  try {
    const parsed = JSON.parse(storage.getItem(VISITED_ITEMS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => Number.isInteger(value));
  } catch {
    return [];
  }
}

export function addVisitedItem(storage: WriteStorage, id: number): void {
  if (!Number.isInteger(id)) return;
  const next = Array.from(new Set([...getVisitedItemIds(storage), id]));
  storage.setItem(VISITED_ITEMS_KEY, JSON.stringify(next));
}

export function enableCompanionMode(storage: Pick<Storage, "setItem">): void {
  storage.setItem(COMPANION_MODE_KEY, "true");
}

export function disableCompanionMode(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(COMPANION_MODE_KEY);
}

export function isCompanionMode(storage: ReadStorage): boolean {
  return storage.getItem(COMPANION_MODE_KEY) === "true";
}

export function markCompanionIntroSeen(storage: Pick<Storage, "setItem">): void {
  storage.setItem(COMPANION_INTRO_SEEN_KEY, "true");
}

export function hasSeenCompanionIntro(storage: ReadStorage): boolean {
  return storage.getItem(COMPANION_INTRO_SEEN_KEY) === "true";
}
