"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import HomeButton from "@/components/visitor/HomeButton";
import BackButton from "@/components/visitor/BackButton";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { groupPath } from "@/lib/groupSlug";
import { loadTourById, ResolvedTour, tourTitle } from "@/lib/tours";

interface PlayerInfo {
  player_id: string;
  nickname: string;
  is_ready: boolean;
  is_host: boolean;
  progress: number;
  is_online: boolean;
  finished: boolean;
  completed_at: string | null;
  status: string; // active or pending
}

interface RoomInfo {
  room_id: string;
  name: string;
  description: string;
  tour_id: string;
  status: string;
  winner_id: string | null;
  winner_nickname: string | null;
  players: PlayerInfo[];
  is_locked: boolean;
}

export default function TourMatchWaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const lobbyPath = useGroupPath("/tour-match");
  const roomId = String(params.roomId);
  const { locale } = useVisitorLocale();

  const [playerId, setPlayerId] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [tour, setTour] = useState<ResolvedTour | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  // 1. Initial Authentication & Identity Check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedNick = localStorage.getItem("hera_match_nickname") || "";
      if (!storedNick) {
        // Redirect to lobby to configure nickname first, saving target room
        router.replace(`${groupPath(groupSlug, "/tour-match")}?join=${roomId}`);
        return;
      }
      setNickname(storedNick);

      let pid = sessionStorage.getItem("hera_match_player_id") || "";
      if (!pid) {
        pid = "player_" + Math.random().toString(36).substring(2, 11);
        sessionStorage.setItem("hera_match_player_id", pid);
      }
      setPlayerId(pid);
    }
  }, [roomId, router, groupSlug]);

  // 2. Load Tour info when room updates
  useEffect(() => {
    if (room?.tour_id) {
      loadTourById(room.tour_id)
        .then(setTour)
        .catch((err) => console.error("Failed to load tour details:", err));
    }
  }, [room?.tour_id]);

  // 3. Establish WebSocket connection
  useEffect(() => {
    if (!playerId || !nickname) return;

    setWsStatus("connecting");
    setErrorMsg(null);

    // Resolve direct backend WebSocket URL
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
    console.log("Connecting to WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      setErrorMsg(null);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received WS message:", message);

        if (message.type === "room_state") {
          setRoom(message.room);
        } else if (message.type === "match_started") {
          // Redirect everyone to the play page
          router.push(groupPath(groupSlug, `/tour-match/room/${roomId}/play`));
        } else if (message.type === "error") {
          setErrorMsg(message.message);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setWsStatus("error");
      setErrorMsg("Lỗi kết nối máy chủ thi đấu");
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setWsStatus("disconnected");
      if (event.code === 4003) {
        setErrorMsg("Phòng không tồn tại hoặc cuộc đua đã bắt đầu");
      } else if (event.code === 4008) {
        setErrorMsg("Bạn đã bị chủ phòng đuổi khỏi phòng đấu");
      } else if (event.code === 4009) {
        setErrorMsg("Yêu cầu tham gia phòng của bạn đã bị từ chối");
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, playerId, nickname, router, groupSlug]);

  const handleToggleReady = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "toggle_ready" }));
    }
  };

  const handleStartMatch = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_match" }));
    }
  };

  const handleLeaveRoom = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave" }));
    }
    router.push(lobbyPath);
  };

  const handleToggleLock = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "toggle_lock" }));
    }
  };

  const handleApprovePlayer = (targetId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "approve_player", target_id: targetId }));
    }
  };

  const handleRejectPlayer = (targetId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reject_player", target_id: targetId }));
    }
  };

  const handleKickPlayer = (targetId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "kick_player", target_id: targetId }));
    }
  };

  const handleCopyInviteLink = () => {
    if (typeof window !== "undefined") {
      const inviteUrl = window.location.href;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  if (errorMsg) {
    return (
      <div className="artifact-shell min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="artifact-card p-6 space-y-4 max-w-xs">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-md font-bold text-red-400">Không thể kết nối</h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {errorMsg}
          </p>
          <button onClick={() => router.push(lobbyPath)} className="artifact-btn-primary w-full text-xs py-2">
            Quay lại Sảnh chờ
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="artifact-shell min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
          />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Đang tải dữ liệu phòng chờ...
          </span>
        </div>
      </div>
    );
  }

  const myState = room.players.find((p) => p.player_id === playerId);
  const isHost = myState?.is_host || false;

  // Split active players from pending requests
  const activePlayers = room.players.filter((p) => p.status === "active");
  const pendingPlayers = room.players.filter((p) => p.status === "pending");

  // Check if others are ready
  const otherPlayers = activePlayers.filter((p) => !p.is_host);
  const allReady = otherPlayers.length > 0 && otherPlayers.every((p) => p.is_ready);

  // Guest Wait Screen if Guest Status is Pending
  if (myState?.status === "pending") {
    return (
      <div className="artifact-shell min-h-screen flex flex-col justify-center items-center p-6 text-center">
        <div className="artifact-card p-6 space-y-4 max-w-sm">
          <span className="text-4xl animate-pulse block">⏳</span>
          <h2 className="text-md font-bold text-primary">Đang Chờ Phê Duyệt</h2>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Phòng đấu này hiện đang được khóa bởi chủ phòng. Vui lòng giữ kết nối và đợi chủ phòng phê duyệt yêu cầu tham gia.
          </p>
          <div className="flex justify-center py-2">
            <div
              className="h-5 w-5 animate-spin rounded-full border border-t-transparent"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
          <button onClick={handleLeaveRoom} className="artifact-btn-secondary w-full text-xs py-2.5">
            Hủy yêu cầu & Rời phòng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-shell min-h-screen pb-8">
      <header className="artifact-page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={handleLeaveRoom} label="Rời phòng" />
        </div>
        <p className="artifact-section-label mb-1">
          Phòng chờ {wsStatus === "connected" ? "• Trực tuyến" : "• Đang kết nối..."}
        </p>
        <h1 className="font-display text-xl">{room.name}</h1>
        {room.description && (
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {room.description}
          </p>
        )}
      </header>

      <div className="p-4 space-y-5 flex-1">
        {/* Room Info Code Box */}
        <div className="artifact-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Mã phòng đấu:
            </span>
            <div className="flex items-center gap-2">
              {isHost && (
                <button
                  onClick={handleToggleLock}
                  className="text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
                  style={{
                    background: room.is_locked ? "rgba(239, 68, 68, 0.15)" : "rgba(34, 197, 94, 0.15)",
                    border: room.is_locked ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid rgba(34, 197, 94, 0.3)",
                    color: room.is_locked ? "#fca5a5" : "#86efac",
                  }}
                >
                  {room.is_locked ? "🔒 Khóa" : "🔓 Mở"}
                </button>
              )}
              <span className="text-md font-bold tracking-widest" style={{ color: "var(--primary)" }}>
                {roomId}
              </span>
            </div>
          </div>

          <div className="border-t py-2 border-dashed" style={{ borderColor: "var(--border)" }} />

          {/* Invite Link copy box */}
          <div className="space-y-1">
            <span className="text-[11px] block" style={{ color: "var(--muted-foreground)" }}>
              Chia sẻ liên kết mời bạn bè:
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="w-full rounded-lg px-2.5 py-1.5 text-[11px] outline-none select-all truncate"
                style={{
                  background: "var(--secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                onClick={handleCopyInviteLink}
                className="artifact-btn-secondary px-3 text-[11px] font-semibold shrink-0"
                style={{ background: copied ? "var(--primary)" : "rgba(14, 11, 7, 0.75)", color: copied ? "var(--primary-foreground)" : "var(--foreground)" }}
              >
                {copied ? "Đã chép!" : "Chép link"}
              </button>
            </div>
          </div>
        </div>

        {/* Selected Tour Card */}
        {tour && (
          <div
            className="artifact-card p-4 flex items-center justify-between"
            style={{ borderLeft: "4px solid var(--primary)" }}
          >
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Tour thi đấu được chọn:
              </p>
              <h3 className="text-sm font-bold">{tourTitle(tour, locale)}</h3>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Số lượng hiện vật: {tour.stops.length} stops
              </p>
            </div>
            <span className="text-2xl">🏛️</span>
          </div>
        )}

        {/* Pending Requests Lobby for Host */}
        {isHost && pendingPlayers.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-yellow-400">
              Yêu cầu tham gia phòng ({pendingPlayers.length})
            </h2>
            <div className="space-y-2">
              {pendingPlayers.map((player) => (
                <div
                  key={player.player_id}
                  className="artifact-card p-3 flex items-center justify-between border-yellow-500/30"
                  style={{ background: "rgba(234, 179, 8, 0.04)" }}
                >
                  <span className="text-xs font-semibold text-foreground">
                    👤 {player.nickname}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleApprovePlayer(player.player_id)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded text-green-400 bg-green-950/40 border border-green-500/35 hover:bg-green-900/40"
                    >
                      Duyệt
                    </button>
                    <button
                      onClick={() => handleRejectPlayer(player.player_id)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded text-red-400 bg-red-950/40 border border-red-500/35 hover:bg-red-900/40"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participants Lobby */}
        <div className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--muted-foreground)" }}>
            Danh sách người chơi ({activePlayers.length})
          </h2>

          <div className="space-y-2">
            {activePlayers.map((player) => {
              const isMe = player.player_id === playerId;
              return (
                <div
                  key={player.player_id}
                  className="artifact-card p-3.5 flex items-center justify-between"
                  style={{
                    borderColor: isMe ? "var(--primary)" : "var(--border)",
                    background: isMe ? "rgba(201, 168, 76, 0.05)" : "var(--card)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {player.is_host ? "👑" : "👤"}
                    </span>
                    <span className="text-xs font-semibold">
                      {player.nickname} {isMe ? <span className="italic" style={{ color: "var(--muted-foreground)" }}>(Bạn)</span> : ""}
                    </span>
                    {!player.is_online && (
                      <span className="text-[10px] font-semibold text-red-400">
                        (Mất mạng)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Host kick control */}
                    {isHost && !player.is_host && (
                      <button
                        onClick={() => handleKickPlayer(player.player_id)}
                        className="text-[10px] px-2 py-1 rounded bg-red-950/40 border border-red-500/35 text-red-400 font-bold active:scale-95 transition-all hover:bg-red-900/40 mr-1.5"
                      >
                        Đuổi
                      </button>
                    )}

                    {player.is_host ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                        Chủ phòng
                      </span>
                    ) : player.is_ready ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-green-400 bg-green-950/40 border border-green-500/35">
                        Sẵn sàng
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded text-yellow-400 bg-yellow-950/40 border border-yellow-500/35">
                        Chờ...
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions Button */}
        <div className="pt-4 space-y-3">
          {isHost ? (
            <div className="space-y-2">
              <button
                onClick={handleStartMatch}
                disabled={!allReady}
                className="artifact-btn-primary w-full py-4 text-sm font-bold transition-all disabled:opacity-50"
              >
                🚀 Bắt đầu cuộc đua!
              </button>
              {!allReady && (
                <p className="text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {otherPlayers.length === 0
                    ? "Cần ít nhất 2 người để bắt đầu tranh tài"
                    : "Đang đợi tất cả người chơi khác Sẵn sàng..."}
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleToggleReady}
              className="w-full rounded-2xl py-4 text-sm font-bold transition-all"
              style={{
                background: myState?.is_ready ? "var(--secondary)" : "var(--primary)",
                color: myState?.is_ready ? "var(--foreground)" : "var(--primary-foreground)",
                border: myState?.is_ready ? "1px solid var(--border)" : "none",
              }}
            >
              {myState?.is_ready ? "⏳ Hủy Sẵn sàng" : "✓ Sẵn sàng!"}
            </button>
          )}

          <button
            onClick={handleLeaveRoom}
            className="w-full text-center py-2.5 text-xs underline"
            style={{ color: "var(--muted-foreground)" }}
          >
            Rời phòng đấu & Về sảnh chờ
          </button>
        </div>
      </div>
    </div>
  );
}
