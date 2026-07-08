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
import { rememberMinimapItem } from "@/lib/minimapState";
import { useGroupSlug } from "@/lib/useGroupPath";
import { buildSearchTrackingContext, readStoredGroupId } from "@/lib/visitorAnalytics";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import {
  clearMatchMembership,
  gameModeLabel,
  normalizeMatchRoom,
  writeMatchMembership,
  type MatchPlayerState,
  type MatchRoomState,
} from "@/lib/tourMatch";
import { getDynamicMinimapConfig, type MinimapConfig } from "@/lib/api";
import { VISITOR_GROUP_ID_KEY } from "@/lib/groupSlug";
import TourMatchMinimap from "@/components/visitor/TourMatchMinimap";
import { loadTourById, ResolvedTour, tourTitle, stopHint } from "@/lib/tours";

type ScanPhase = "idle" | "scanning" | "found";
const TOUR_MATCH_MIN = 0.55;

interface PlayerInfo extends MatchPlayerState {}

interface RoomInfo extends MatchRoomState {}

export default function TourMatchPlayPage() {
  const params = useParams();
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const roomId = String(params.roomId);
  const lobbyPath = groupPath(groupSlug, "/tour-match");
  const { locale, t } = useVisitorLocale();

  const [playerId, setPlayerId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [tour, setTour] = useState<ResolvedTour | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Camera scanning states
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showHintModal, setShowHintModal] = useState(false);
  const [minimapConfig, setMinimapConfig] = useState<MinimapConfig | null>(null);
  
  // Local tour progress
  const [myProgress, setMyProgress] = useState(0);
  const [myFoundIds, setMyFoundIds] = useState<number[]>([]);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Confetti particles generator for victory mode
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; duration: number; color: string; size: number }>>([]);

  useEffect(() => {
    // Generate 60 confetti particles
    const arr = Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
      color: ["#c9a84c", "#f0e8d5", "#e5c158", "#9a8a6a", "#ffffff"][Math.floor(Math.random() * 5)],
      size: Math.random() * 8 + 6,
    }));
    setConfetti(arr);
  }, []);

  // 1. Initial Identity Verification
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedNick = localStorage.getItem("hera_match_nickname") || "";
      if (!storedNick) {
        router.replace(`${groupPath(groupSlug, "/tour-match")}?join=${roomId}`);
        return;
      }
      setNickname(storedNick);

      let pid = sessionStorage.getItem("hera_match_player_id") || "";
      if (!pid) {
        // If totally missing player ID, redirect back to room page to register
        router.replace(groupPath(groupSlug, `/tour-match/room/${roomId}`));
        return;
      }
      setPlayerId(pid);
    }
  }, [roomId, router, groupSlug]);

  // 2. Establish WebSocket connection
  useEffect(() => {
    if (!playerId || !nickname) return;

    let apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    let wsBase = "";

    if (!apiBase) {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        wsBase = "ws://localhost:8000";
      } else {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsBase = `${proto}//${window.location.host}`;
      }
    } else {
      wsBase = apiBase.replace(/^http/, "ws");
    }

    const wsUrl = `${wsBase}/api/tour-match/ws/${roomId}/${playerId}?nickname=${encodeURIComponent(nickname)}`;
    console.log("Connecting play WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Play message received:", message);

        if (message.type === "room_state" || message.type === "match_started" || message.type === "match_finished") {
          setRoom(normalizeMatchRoom(message.room));
          
          const mine = message.room.players.find((p: PlayerInfo) => p.player_id === playerId);
          if (mine) {
            setMyProgress(mine.progress);
            setMyFoundIds(mine.found_item_ids ?? []);
          }
        } else if (message.type === "find_rejected") {
          if (message.player_id === playerId) {
            setErrorMsg(t.tour.matchAlreadyFound);
          }
        }
      } catch (err) {
        console.error("Failed to parse socket data:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("Play WebSocket error:", err);
      setErrorMsg(t.tour.matchErrConnectServer);
    };

    ws.onclose = (event) => {
      console.log("Play WebSocket closed:", event.code, event.reason);
      if (event.code === 4003) {
        setErrorMsg(t.tour.matchErrNotInPlayers);
      } else if (event.code === 4008) {
        setErrorMsg(t.tour.matchErrKicked);
      } else {
        setErrorMsg(t.tour.matchErrDisconnected);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, playerId, nickname, t]);

  // 3. Load Tour details
  useEffect(() => {
    if (room?.tour_id && loading) {
      loadTourById(room.tour_id)
        .then((data) => {
          setTour(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load tour details:", err);
          setLoading(false);
        });
    }
  }, [room?.tour_id, loading]);

  useEffect(() => {
    if (!room?.with_map) {
      setMinimapConfig(null);
      return;
    }
    const groupId = Number(window.localStorage.getItem(VISITOR_GROUP_ID_KEY));
    if (!Number.isInteger(groupId) || groupId <= 0) return;
    void getDynamicMinimapConfig(groupId)
      .then(setMinimapConfig)
      .catch(() => setMinimapConfig(null));
  }, [room?.with_map]);

  useEffect(() => {
    if (!roomId || !playerId || !nickname) return;
    writeMatchMembership({ groupSlug, roomId, playerId, nickname });
  }, [groupSlug, roomId, playerId, nickname]);

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

  const handleCapture = async (blob: Blob) => {
    if (!tour || !room) return;

    const totalStops = tour.stops.length;
    const me = room.players.find((player) => player.player_id === playerId);
    if (!me || myProgress >= totalStops) return;

    const gameMode = room.game_mode;
    const expectedId =
      gameMode === "free" ? null : me.current_target_item_id ?? me.stop_order[myProgress] ?? null;

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
      const matchedId = best ? Number(best.item_id) : null;
      const similarityOk =
        best && (response.found || best.similarity >= TOUR_MATCH_MIN);

      let accepted = false;
      if (matchedId && similarityOk) {
        if (gameMode === "free") {
          accepted =
            room.stop_item_ids.includes(matchedId) && !myFoundIds.includes(matchedId);
          if (room.stop_item_ids.includes(matchedId) && myFoundIds.includes(matchedId)) {
            setErrorMsg(t.tour.matchAlreadyFound);
          }
        } else if (expectedId !== null) {
          accepted = matchedId === expectedId;
        }
      }

      if (accepted && matchedId !== null) {
        setScanPhase("found");
        rememberMinimapItem(groupSlug, matchedId);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "report_find",
            item_id: matchedId,
          }));
        }

        setTimeout(() => {
          setScanPhase("idle");
          setScanProgress(0);
          setFrozen(false);
          setCapturedUrl(null);
          URL.revokeObjectURL(url);
        }, 1200);
        return;
      }

      const currentStop =
        expectedId !== null
          ? tour.stops.find((stop) => stop.itemId === expectedId) ?? null
          : null;

      const candidates = response.results || [];
      const expectedResult =
        expectedId !== null
          ? candidates.find((result) => Number(result.item_id) === expectedId)
          : null;
      const similarityScore = expectedResult ? expectedResult.similarity : best?.similarity ?? 0;
      const matchPercent = Math.round(similarityScore * 100);

      if (gameMode === "free" && matchedId && myFoundIds.includes(matchedId)) {
        setErrorMsg(t.tour.matchAlreadyFound);
      } else if (best && expectedId !== null && Number(best.item_id) !== expectedId) {
        setErrorMsg(
          t.tour.matchWrongObject
            .replace("{name}", currentStop?.name ?? "")
            .replace("{percent}", String(matchPercent))
            .replace("{min}", "55")
        );
      } else {
        setErrorMsg(
          t.tour.matchScanUnrecognized
            .replace("{percent}", String(matchPercent))
            .replace("{min}", "55")
        );
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

  const handleSoftExit = () => {
    router.push(lobbyPath);
  };

  const handleLeaveMatch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave" }));
    }
    clearMatchMembership();
    router.push(lobbyPath);
  };

  if (errorMsg && !room) {
    return (
      <div className="flex flex-1 min-h-[100dvh] flex-col justify-center items-center p-6 text-center w-full">
        <div className="artifact-card p-6 space-y-4 max-w-xs">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-md font-bold text-red-400">{t.tour.matchCannotConnect}</h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {errorMsg}
          </p>
          <button onClick={() => router.push(lobbyPath)} className="artifact-btn-primary w-full text-xs py-2">
            {t.tour.matchBackToLobby}
          </button>
        </div>
      </div>
    );
  }

  if (loading || !tour || !room) {
    return (
      <div className="flex flex-1 min-h-[100dvh] items-center justify-center w-full">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  const totalStops = tour.stops.length;
  const isFinished = myProgress >= totalStops;
  const me = room.players.find((player) => player.player_id === playerId);
  const targetItemId =
    room.game_mode === "free"
      ? null
      : me?.current_target_item_id ?? me?.stop_order[myProgress] ?? null;
  const currentStop =
    targetItemId !== null
      ? tour.stops.find((stop) => stop.itemId === targetItemId) ?? null
      : null;

  // Sort players for leaderboard: progress (descending), then completion time
  const sortedPlayers = [...room.players].sort((a, b) => {
    if (b.progress !== a.progress) {
      return b.progress - a.progress;
    }
    if (a.completed_at && b.completed_at) {
      return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
    }
    if (a.completed_at) return -1;
    if (b.completed_at) return 1;
    return 0;
  });

  return (
    <main className="flex flex-1 flex-col w-full relative overflow-hidden">
      
      {/* Background grain aesthetic */}
      <div className="artifact-grain" />

      {/* Header */}
      <header className="artifact-page-head shrink-0" style={{ borderBottom: "1px solid var(--border)", background: "rgba(14,11,7,0.85)", backdropFilter: "blur(4px)" }}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HomeButton />
            <BackButton onClick={handleSoftExit} label={t.common.back} variant="dark" />
          </div>
          <LanguageSelector compact />
        </div>
        <p className="artifact-section-label mb-0.5">
          {room.name} • {gameModeLabel(room.game_mode, locale)}
        </p>
        <h1 className="font-display text-base tracking-normal truncate">{tourTitle(tour, locale)}</h1>
      </header>

      {/* Real-time Multiplayer Leaderboard */}
      <div className="bg-secondary/40 border-b border-border px-4 py-2.5 space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t.tour.matchLeaderboardLive}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">🏁 {totalStops} {t.tour.stops}</span>
        </div>
        <div className="flex flex-wrap gap-2 pb-1">
          {sortedPlayers.map((p, idx) => {
            const isMe = p.player_id === playerId;
            const pct = Math.min((p.progress / totalStops) * 100, 100);
            return (
              <div
                key={p.player_id}
                className="shrink-0 w-28 artifact-card p-2 space-y-1 text-left relative overflow-hidden"
                style={{
                  borderColor: isMe ? "var(--primary)" : "rgba(201,168,76,0.15)",
                  background: isMe ? "rgba(201,168,76,0.06)" : "rgba(26,21,16,0.65)",
                }}
              >
                {/* Ranking number flag */}
                <span className="absolute top-1 right-1 text-[8px] font-bold text-muted-foreground">
                  #{idx + 1}
                </span>
                
                <p className="text-[10px] font-semibold truncate pr-4" style={{ color: isMe ? "var(--primary)" : "var(--foreground)" }}>
                  {p.is_host ? "👑 " : ""}{p.nickname}
                </p>
                <div className="flex items-center justify-between text-[9px] text-muted-foreground leading-none">
                  <span>{t.tour.matchProgressLabel}</span>
                  <span className="font-bold text-foreground">{p.progress}/{totalStops}</span>
                </div>
                
                {/* Micro progress bar */}
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Play Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {room.with_map ? (
          <div className="w-full max-w-xs">
            <TourMatchMinimap
              config={minimapConfig}
              tourItemIds={room.stop_item_ids}
              foundItemIds={myFoundIds}
              currentTargetItemId={targetItemId}
              showCurrentTarget={room.game_mode !== "free"}
              title={t.tour.matchMapTitle}
              mapLabel={t.minimap.notAvailable}
              legendPending={t.tour.matchMapPending}
              legendFound={t.tour.matchMapFound}
              legendCurrent={t.tour.matchMapCurrent}
            />
          </div>
        ) : null}

        {isFinished ? (
          <div className="artifact-card p-6 text-center max-w-xs space-y-4">
            <span className="text-4xl animate-bounce block">🏁</span>
            <h2 className="text-md font-bold text-primary">{t.tour.matchRaceCompleteTitle}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.tour.matchRaceCompleteHint}
            </p>
            <div className="flex justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border border-t-transparent" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-4">
              <div className="w-full text-center space-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-primary">
                    {room.game_mode === "free"
                      ? t.tour.matchFreeTarget
                      : t.tour.matchNextTarget}
                  </p>
                  {currentStop ? (
                    <h2 className="text-md font-bold text-foreground leading-tight">{currentStop.name}</h2>
                  ) : null}
                </div>
                {currentStop ? (
                  <button
                    type="button"
                    onClick={() => setShowHintModal(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-secondary/80 hover:bg-secondary active:scale-95 transition-all text-primary"
                    style={{ borderColor: "rgba(201,168,76,0.3)" }}
                  >
                    💡 {t.tour.matchViewHint}
                  </button>
                ) : null}
              </div>

              {/* Scan viewport */}
              <div className="relative w-full max-w-sm">
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
                  {!isFinished && scanPhase === "idle" ? (
                    <button
                      type="button"
                      onClick={() => document.getElementById("camera-capture-btn")?.click()}
                      disabled={scanPhase !== "idle"}
                      className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl py-3.5 text-xs font-semibold transition-all disabled:opacity-40 active:scale-[0.98]"
                      style={{
                        background: "rgba(14, 11, 7, 0.45)",
                        border: "1px solid rgba(201, 168, 76, 0.35)",
                        color: "#f0e8d5",
                        backdropFilter: "blur(6px)",
                      }}
                    >
                      {t.scan.hiddenCapture} ({myProgress + 1}/{totalStops})
                    </button>
                  ) : null}
                </ScanViewfinderFrame>
              </div>

              {/* Error log info */}
              {errorMsg && (
                <div
                  className="w-full max-w-xs rounded-xl px-4 py-2.5 text-center text-xs"
                  style={{
                    background: "rgba(212,24,61,0.15)",
                    border: "1px solid rgba(212,24,61,0.35)",
                    color: "#f0e8d5",
                  }}
                >
                  {errorMsg}
                </div>
              )}
            </div>
        )}
      </div>

      {/* Victory Celebration Overlay Modal */}
      {room.status === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(14,11,7,0.9)" }}>
          
          {/* Confetti Animation Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confetti.map((particle) => (
              <div
                key={particle.id}
                className="absolute animate-confetti-fall"
                style={{
                  left: `${particle.left}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  backgroundColor: particle.color,
                  animationDelay: `${particle.delay}s`,
                  animationDuration: `${particle.duration}s`,
                  top: "-20px",
                  borderRadius: "50%",
                  opacity: 0.8,
                }}
              />
            ))}
          </div>

          {/* Modal content Card */}
          <div className="artifact-card p-6 max-w-sm w-full space-y-5 text-center relative z-10 border border-primary/40 shadow-2xl bg-card">
            <div className="space-y-1">
              <span className="text-5xl animate-bounce block">🏆</span>
              <h2 className="text-lg font-bold font-display text-primary uppercase tracking-wide">
                {t.tour.matchResultsTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t.tour.matchResultsSubtitle}
              </p>
            </div>

            {/* Winner Spotlight Banner */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold">{t.tour.matchChampionLabel}</p>
              <h3 className="text-lg font-extrabold text-foreground flex items-center justify-center gap-1.5">
                👑 {room.winner_nickname}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {t.tour.matchChampionHint}
              </p>
            </div>

            {/* Standings list */}
            <div className="space-y-2 text-left">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
                {t.tour.matchFinalStandings}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {sortedPlayers.map((p, index) => {
                  const isWinner = p.player_id === room.winner_id;
                  const isMe = p.player_id === playerId;
                  return (
                    <div
                      key={p.player_id}
                      className="flex items-center justify-between p-2 rounded-lg"
                      style={{
                        background: isMe ? "rgba(201, 168, 76, 0.08)" : "var(--secondary)",
                        border: isMe ? "1px solid var(--primary)" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-4">#{index + 1}</span>
                        <span className="font-semibold truncate max-w-[120px]">
                          {p.nickname} {isMe ? t.tour.matchYou : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                        {isWinner ? (
                          <span className="text-yellow-400 font-bold">{t.tour.matchChampionBadge}</span>
                        ) : p.completed_at ? (
                          <span>{t.tour.matchCompletedBadge}</span>
                        ) : (
                          <span>{p.progress}/{totalStops} {t.tour.stops}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Exit Action button */}
            <button
              onClick={handleLeaveMatch}
              className="artifact-btn-primary w-full py-3.5 text-xs font-bold"
            >
              {t.tour.matchBackToLobby}
            </button>
          </div>
        </div>
      )}

      {/* Hint Suggestion Modal */}
      {showHintModal && currentStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" style={{ background: "rgba(14,11,7,0.85)", backdropFilter: "blur(6px)" }}>
          <div 
            className="artifact-card p-5 max-w-sm w-full space-y-4 text-left relative z-10 border border-primary/20 shadow-2xl bg-card animate-scale-in"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                💡 {t.tour.matchArtifactHint}
              </h3>
              <button 
                onClick={() => setShowHintModal(false)}
                className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs hover:bg-secondary/80 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Stop Image */}
            <div 
              className="w-full h-44 rounded-xl overflow-hidden relative border border-border bg-secondary"
            >
              {currentStop.imageUrl ? (
                <img 
                  src={currentStop.imageUrl} 
                  alt={currentStop.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                  {t.common.noImage}
                </div>
              )}
            </div>

            {/* Stop Info */}
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-bold text-foreground">{currentStop.name}</h4>
              </div>

              {/* Hint text if present */}
              {stopHint(currentStop, locale) && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-2.5 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                    {t.tour.matchSearchTip}
                  </span>
                  <p className="text-[11px] text-foreground leading-relaxed">
                    {stopHint(currentStop, locale)}
                  </p>
                </div>
              )}

              {/* Description text if present and different from hint */}
              {currentStop.description && currentStop.description.trim() !== stopHint(currentStop, locale).trim() && (
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    {t.tour.matchObjectDescription}
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-h-24 overflow-y-auto pr-1">
                    {currentStop.description}
                  </p>
                </div>
              )}
            </div>

            {/* Close action */}
            <button
              onClick={() => setShowHintModal(false)}
              className="artifact-btn-secondary w-full py-2.5 text-xs font-bold"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}

      {/* Styling keyframes injection for Confetti & Modal */}
      <style jsx global>{`
        @keyframes confettiFall {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
          }
        }
        .animate-confetti-fall {
          animation: confettiFall linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </main>
  );
}
