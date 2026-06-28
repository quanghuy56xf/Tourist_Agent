export const COMPANION_MODE_KEY = "hera_companion_mode";
export const COMPANION_INTRO_SEEN_KEY = "hera_companion_intro_seen";
export const VISITED_ITEMS_KEY = "hera_companion_visited_items";
export const COMPANION_QUEST_STATE_KEY = "hera_companion_quest_state";

export type CompanionQuestStatus =
  | "not_started"
  | "bait_prompted"
  | "quests_unlocked"
  | "quest_active"
  | "quest_completed";

export type CompanionQuestState = {
  status: CompanionQuestStatus;
  selectedQuestId?: string;
  currentStopIndex?: number;
  completedStopIds?: string[];
  answeredStopIds?: string[];
  rewardClaimed?: boolean;
};

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

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

export function getCompanionQuestState(storage: ReadStorage): CompanionQuestState {
  try {
    const parsed = JSON.parse(storage.getItem(COMPANION_QUEST_STATE_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return { status: "not_started" };
    if (
      ![
        "not_started",
        "bait_prompted",
        "quests_unlocked",
        "quest_active",
        "quest_completed",
      ].includes(parsed.status)
    ) {
      return { status: "not_started" };
    }
    return {
      status: parsed.status,
      selectedQuestId:
        typeof parsed.selectedQuestId === "string" ? parsed.selectedQuestId : undefined,
      currentStopIndex: Number.isInteger(parsed.currentStopIndex)
        ? Math.max(0, parsed.currentStopIndex)
        : undefined,
      completedStopIds: readStringArray(parsed.completedStopIds),
      answeredStopIds: readStringArray(parsed.answeredStopIds),
      rewardClaimed: parsed.rewardClaimed === true,
    };
  } catch {
    return { status: "not_started" };
  }
}

export function setCompanionQuestState(
  storage: Pick<Storage, "setItem">,
  state: CompanionQuestState
): void {
  storage.setItem(COMPANION_QUEST_STATE_KEY, JSON.stringify(state));
}

export function startCompanionQuest(
  storage: Pick<Storage, "setItem">,
  questId: string
): CompanionQuestState {
  const state: CompanionQuestState = {
    status: "quest_active",
    selectedQuestId: questId,
    currentStopIndex: 0,
    completedStopIds: [],
    answeredStopIds: [],
    rewardClaimed: false,
  };
  setCompanionQuestState(storage, state);
  return state;
}

export function advanceCompanionQuest(
  storage: WriteStorage,
  stopId: string,
  totalStops: number
): CompanionQuestState {
  const current = getCompanionQuestState(storage);
  const completedStopIds = Array.from(
    new Set([...(current.completedStopIds ?? []), stopId])
  );
  const answeredStopIds = Array.from(
    new Set([...(current.answeredStopIds ?? []), stopId])
  );
  const nextIndex = Math.min((current.currentStopIndex ?? 0) + 1, totalStops);
  const state: CompanionQuestState = {
    ...current,
    status: nextIndex >= totalStops ? "quest_completed" : "quest_active",
    currentStopIndex: nextIndex,
    completedStopIds,
    answeredStopIds,
  };
  setCompanionQuestState(storage, state);
  return state;
}

export function unlockCompanionQuests(storage: Pick<Storage, "setItem">): CompanionQuestState {
  const state: CompanionQuestState = { status: "quests_unlocked" };
  setCompanionQuestState(storage, state);
  return state;
}

export function resetCompanionQuest(storage: Pick<Storage, "setItem">): CompanionQuestState {
  const state: CompanionQuestState = { status: "not_started" };
  setCompanionQuestState(storage, state);
  return state;
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
