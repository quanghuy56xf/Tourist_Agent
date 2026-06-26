import type { VisitorLocale } from "@/lib/i18n";

export type GameMode = "sequential" | "sequential_random" | "free";

export interface MatchMembership {
  groupSlug: string;
  roomId: string;
  playerId: string;
  nickname: string;
}

export interface MatchPlayerState {
  player_id: string;
  nickname: string;
  is_ready: boolean;
  is_host: boolean;
  progress: number;
  stop_order: number[];
  found_item_ids: number[];
  current_target_item_id: number | null;
  is_online: boolean;
  status: string;
  finished: boolean;
  completed_at: string | null;
}

export interface MatchRoomState {
  room_id: string;
  name: string;
  description: string;
  tour_id: string;
  game_mode: GameMode;
  with_map: boolean;
  stop_item_ids: number[];
  status: string;
  winner_id: string | null;
  winner_nickname: string | null;
  is_locked: boolean;
  finished_at: string | null;
  players: MatchPlayerState[];
}

const GAME_MODES = ["sequential", "sequential_random", "free"] as const;

export function normalizeGameMode(mode: unknown): GameMode {
  if (typeof mode === "string" && (GAME_MODES as readonly string[]).includes(mode)) {
    return mode as GameMode;
  }
  return "sequential";
}

export function normalizeMatchRoom(raw: Record<string, unknown>): MatchRoomState {
  const players = Array.isArray(raw.players) ? raw.players : [];
  return {
    room_id: String(raw.room_id ?? ""),
    name: String(raw.name ?? ""),
    description: String(raw.description ?? ""),
    tour_id: String(raw.tour_id ?? ""),
    game_mode: normalizeGameMode(raw.game_mode),
    with_map: Boolean(raw.with_map),
    stop_item_ids: Array.isArray(raw.stop_item_ids)
      ? raw.stop_item_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [],
    status: String(raw.status ?? "waiting"),
    winner_id: raw.winner_id != null ? String(raw.winner_id) : null,
    winner_nickname: raw.winner_nickname != null ? String(raw.winner_nickname) : null,
    is_locked: Boolean(raw.is_locked),
    finished_at: raw.finished_at != null ? String(raw.finished_at) : null,
    players: players as MatchPlayerState[],
  };
}

const MEMBERSHIP_KEY = "hera_match_membership";

const GAME_MODE_LABELS: Record<
  GameMode,
  Record<VisitorLocale, string>
> = {
  sequential: {
    vi: "Tuần tự (cùng lộ trình)",
    en: "Sequential (shared route)",
    fr: "Séquentiel (parcours commun)",
    ja: "順番通り（共通ルート）",
    ko: "순차 (공통 경로)",
    zh: "顺序（共享路线）",
  },
  sequential_random: {
    vi: "Tuần tự ngẫu nhiên (mỗi người một thứ tự)",
    en: "Shuffled sequential (unique per player)",
    fr: "Séquentiel mélangé (ordre unique par joueur)",
    ja: "シャッフル順番（プレイヤーごとに異なる）",
    ko: "섞인 순차 (플레이어마다 다른 순서)",
    zh: "随机顺序（每人不同）",
  },
  free: {
    vi: "Không tuần tự (tìm bất kỳ)",
    en: "Free order (any item)",
    fr: "Libre (n'importe quel objet)",
    ja: "自由（どの資料でも可）",
    ko: "자유 (아무 유물)",
    zh: "自由（任意文物）",
  },
};

export function gameModeLabel(mode: unknown, locale: VisitorLocale): string {
  const normalized = normalizeGameMode(mode);
  return GAME_MODE_LABELS[normalized][locale];
}

export function readMatchMembership(): MatchMembership | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MEMBERSHIP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchMembership;
  } catch {
    return null;
  }
}

export function writeMatchMembership(membership: MatchMembership): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(membership));
}

export function clearMatchMembership(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MEMBERSHIP_KEY);
}

export function ensurePlayerId(): string {
  if (typeof window === "undefined") return "";
  let playerId = sessionStorage.getItem("hera_match_player_id") || "";
  if (!playerId) {
    playerId = `player_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("hera_match_player_id", playerId);
  }
  return playerId;
}
