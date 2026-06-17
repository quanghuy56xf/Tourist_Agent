"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HomeButton from "@/components/visitor/HomeButton";
import BackButton from "@/components/visitor/BackButton";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { groupPath } from "@/lib/groupSlug";
import { loadSuggestedTours, ResolvedTour, tourTitle } from "@/lib/tours";
import { fetchApi } from "@/lib/api";

interface MatchRoomSummary {
  room_id: string;
  name: string;
  description: string;
  tour_id: string;
  player_count: number;
  status: string;
}

export default function TourMatchLobbyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupSlug = useGroupSlug();
  const homePath = useGroupPath("");
  const { locale } = useVisitorLocale();

  const preselectedTour = searchParams ? searchParams.get("tour") || "" : "";

  const [nickname, setNickname] = useState<string>("");
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [rooms, setRooms] = useState<MatchRoomSummary[]>([]);
  const [tours, setTours] = useState<ResolvedTour[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingTours, setLoadingTours] = useState(true);

  // Form states for creating a room
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [selectedTourId, setSelectedTourId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load nickname from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hera_match_nickname") || "";
      setNickname(stored);
      setNicknameInput(stored);
      if (!stored) {
        setIsEditingNickname(true);
      }
    }
  }, []);

  // Fetch active rooms
  const refreshRooms = async () => {
    setLoadingRooms(true);
    try {
      const data = await fetchApi("/api/tour-match/rooms");
      setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  // Fetch rooms and tours
  useEffect(() => {
    refreshRooms();
    loadSuggestedTours()
      .then((data) => {
        setTours(data);
        if (preselectedTour && data.some((t) => t.id === preselectedTour)) {
          setSelectedTourId(preselectedTour);
        } else if (data.length > 0) {
          setSelectedTourId(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to load tours:", err))
      .finally(() => setLoadingTours(false));

    // Polling rooms list every 5 seconds
    const interval = setInterval(refreshRooms, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nicknameInput.trim();
    if (!clean) return;
    localStorage.setItem("hera_match_nickname", clean);
    setNickname(clean);
    setIsEditingNickname(false);
    setErrorMsg(null);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setErrorMsg("Vui lòng nhập tên phòng");
      return;
    }
    if (!selectedTourId) {
      setErrorMsg("Vui lòng chọn một tour thi đấu");
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi("/api/tour-match/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName.trim(),
          description: roomDesc.trim(),
          tour_id: selectedTourId,
        }),
      });
      router.push(groupPath(groupSlug, `/tour-match/room/${res.room_id}`));
    } catch (err: any) {
      setErrorMsg(err.message || "Tạo phòng đấu thất bại");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (roomId: string) => {
    router.push(groupPath(groupSlug, `/tour-match/room/${roomId}`));
  };

  return (
    <div className="artifact-shell min-h-screen pb-8">
      <header className="artifact-page-head" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={() => router.push(homePath)} label="Trang chủ" />
        </div>
        <p className="artifact-section-label mb-1">Thi Đấu Trực Tuyến</p>
        <h1 className="font-display text-xl">Sảnh Chờ Thi Đấu</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          Giao lưu, tạo phòng và thử thách khả năng nhận diện di vật cùng bạn bè.
        </p>
      </header>

      {isEditingNickname ? (
        <div className="p-4 flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
          <form onSubmit={handleSaveNickname} className="artifact-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-center" style={{ color: "var(--primary)" }}>
              ✦ Nhập Biệt Danh ✦
            </h2>
            <p className="text-xs text-center" style={{ color: "var(--muted-foreground)" }}>
              Bạn cần có một biệt danh để nhận dạng trong phòng đấu.
            </p>
            <div>
              <input
                type="text"
                maxLength={20}
                required
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Ví dụ: Anh Hùng Sử Việt"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-center"
                style={{
                  background: "var(--secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <button type="submit" className="artifact-btn-primary w-full text-sm font-semibold">
              Xác nhận & Vào sảnh
            </button>
          </form>
        </div>
      ) : (
        <div className="p-4 space-y-6 flex-1">
          {/* User Profile Bar */}
          <div
            className="artifact-card p-4 flex items-center justify-between"
            style={{ borderColor: "rgba(201, 168, 76, 0.4)" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👑</span>
              <div>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Biệt danh của bạn:
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                  {nickname}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsEditingNickname(true)}
              className="text-xs underline"
              style={{ color: "var(--muted-foreground)" }}
            >
              Đổi biệt danh
            </button>
          </div>

          {errorMsg && (
            <div
              className="rounded-xl px-4 py-3 text-center text-sm"
              style={{
                background: "rgba(212,24,61,0.15)",
                border: "1px solid rgba(212,24,61,0.35)",
                color: "#fca5a5",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Create Room Accordion/Form */}
          <div className="artifact-card p-5 space-y-4">
            <h2 className="text-md font-bold font-display" style={{ color: "var(--primary)" }}>
              ✙ Tạo Phòng Thi Đấu Mới
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                    Tên phòng
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    placeholder="Ví dụ: Đấu trường Lam Kinh"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs outline-none"
                    style={{
                      background: "var(--secondary)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                    Chọn Tour thi đấu
                  </label>
                  {loadingTours ? (
                    <div className="text-xs py-2" style={{ color: "var(--muted-foreground)" }}>
                      Đang tải danh sách tour...
                    </div>
                  ) : (
                    <select
                      value={selectedTourId}
                      onChange={(e) => setSelectedTourId(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-xs outline-none cursor-pointer"
                      style={{
                        background: "var(--secondary)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    >
                      {tours.map((t) => (
                        <option key={t.id} value={t.id}>
                          {tourTitle(t, locale)} ({t.stops.length} stop)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                  Mô tả phòng (không bắt buộc)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Ví dụ: Ai chụp nhanh nhất sẽ thắng!"
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs outline-none"
                  style={{
                    background: "var(--secondary)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isCreating || loadingTours}
                className="artifact-btn-primary w-full py-3 text-xs font-bold transition-all disabled:opacity-50"
              >
                {isCreating ? "Đang tạo phòng..." : "Tạo Phòng Mới & Vào Chờ"}
              </button>
            </form>
          </div>

          {/* Active Rooms List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-md font-bold font-display" style={{ color: "var(--primary)" }}>
                ⚔ Danh Sách Phòng Đang Chờ
              </h2>
              <button
                onClick={refreshRooms}
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  background: "var(--secondary)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              >
                ⟳ Làm mới
              </button>
            </div>

            {loadingRooms ? (
              <div className="flex justify-center py-10">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
                />
              </div>
            ) : rooms.length === 0 ? (
              <div className="artifact-card p-8 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                Hiện không có phòng đấu nào đang chờ. Hãy tự tạo phòng đầu tiên!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {rooms.map((room) => {
                  const tourObj = tours.find((t) => t.id === room.tour_id);
                  const displayTourTitle = tourObj ? tourTitle(tourObj, locale) : room.tour_id;
                  return (
                    <div
                      key={room.room_id}
                      className="artifact-card p-4 flex items-center justify-between gap-4 transition-all hover:scale-[1.01]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--secondary)", color: "var(--primary)", border: "1px solid var(--border)" }}>
                            Code: {room.room_id}
                          </span>
                          <span className="text-sm font-bold">{room.name}</span>
                        </div>
                        {room.description && (
                          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                            {room.description}
                          </p>
                        )}
                        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                          Tour: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{displayTourTitle}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(201, 168, 76, 0.1)", border: "1px solid var(--border)" }}>
                          👥 {room.player_count} người
                        </span>
                        <button
                          onClick={() => handleJoinRoom(room.room_id)}
                          className="artifact-btn-primary py-2 px-4 text-xs font-bold rounded-xl active:scale-95"
                          style={{ minHeight: "0px" }}
                        >
                          Vào phòng →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
