"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chatWithCompanion, ChatMessage, transcribeAudio } from "@/lib/api";
import { playChatTts, stopChatTts } from "@/lib/chatTts";
import { getVisitedItemIds } from "@/lib/companionState";
import { rememberMinimapSuggestion } from "@/lib/minimapState";
import { getVisitorSessionId } from "@/lib/visitorAnalytics";
import { useGroupSlug } from "@/lib/useGroupPath";
import {
  cancelRecording,
  isVoiceInputSupported,
  startRecording,
  stopRecording,
} from "@/lib/voiceInput";
import CompanionAvatar from "./CompanionAvatar";

interface CompanionChatProps {
  itemId?: number;
  initialNarration?: string;
  compact?: boolean;
  showIntro?: boolean;
  onCompleteIntro?: () => void;
}

function useStreamingText(text: string): string {
  const [length, setLength] = useState(text.length);

  useEffect(() => {
    setLength(0);
    if (!text) return;
    const timer = window.setInterval(() => {
      setLength((current) => {
        const next = Math.min(text.length, current + 3);
        if (next >= text.length) window.clearInterval(timer);
        return next;
      });
    }, 28);
    return () => window.clearInterval(timer);
  }, [text]);

  return text.slice(0, length);
}

export default function CompanionChat({
  itemId,
  initialNarration = "",
  compact = false,
  showIntro = false,
  onCompleteIntro,
}: CompanionChatProps) {
  const groupSlug = useGroupSlug();
  const [history, setHistory] = useState<ChatMessage[]>(
    initialNarration
      ? [{ role: "assistant", content: initialNarration }]
      : []
  );
  
  // Add keyframes for the sound wave effect
  useEffect(() => {
    if (typeof document !== "undefined") {
      const styleId = "companion-chat-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          @keyframes sound-wave-1 { 0%, 100% { height: 12px; opacity: 0.5; } 50% { height: 24px; opacity: 1; } }
          @keyframes sound-wave-2 { 0%, 100% { height: 16px; opacity: 0.6; } 50% { height: 36px; opacity: 1; } }
          @keyframes sound-wave-3 { 0%, 100% { height: 20px; opacity: 0.7; } 50% { height: 48px; opacity: 1; } }
          @keyframes sound-wave-4 { 0%, 100% { height: 18px; opacity: 0.6; } 50% { height: 32px; opacity: 1; } }
          @keyframes sound-wave-5 { 0%, 100% { height: 14px; opacity: 0.5; } 50% { height: 20px; opacity: 1; } }
          .companion-chat-scroll::-webkit-scrollbar { width: 6px; }
          .companion-chat-scroll::-webkit-scrollbar-track { background: transparent; }
          .companion-chat-scroll::-webkit-scrollbar-thumb { background: rgba(251, 191, 36, 0.2); border-radius: 10px; }
          .companion-chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(251, 191, 36, 0.4); }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionRequested, setSuggestionRequested] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const latestAssistant = useMemo(
    () => [...history].reverse().find((entry) => entry.role === "assistant")?.content ?? "",
    [history]
  );
  const streamedAssistant = useStreamingText(latestAssistant);
  const micSupported = isVoiceInputSupported();
  useEffect(() => {
    if (!initialNarration.trim()) return;
    setHistory((current) => {
      if (current.some(
        (entry) =>
          entry.role === "assistant" && entry.content === initialNarration
      )) {
        return current;
      }
      return [{ role: "assistant", content: initialNarration }, ...current];
    });
  }, [initialNarration]);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isLoading]);

  useEffect(() => {
    if (!itemId || !initialNarration || suggestionRequested) return;
    setSuggestionRequested(true);
    const visited = getVisitedItemIds(window.localStorage);
    void chatWithCompanion(
      itemId,
      "Hãy gợi ý ngắn gọn một câu dẫn du khách đến điểm tiếp theo.",
      [],
      visited,
      getVisitorSessionId(),
      true
    )
      .then((response) => {
        if (response.next_item_id !== null) {
          rememberMinimapSuggestion(groupSlug, response.next_item_id);
        }
        setHistory((current) => [
          ...current,
          { role: "assistant", content: response.content },
        ]);
      })
      .catch(() => {
        // A suggestion is helpful but must not block the main narration.
      });
  }, [groupSlug, initialNarration, itemId, suggestionRequested]);

  useEffect(() => {
    return () => {
      cancelRecording();
      stopChatTts();
    };
  }, []);

  const speak = async (content: string) => {
    if (!content.trim()) return;
    setIsSpeaking(true);
    try {
      await playChatTts(content, "Tiếng Việt", undefined, "Companion");
    } catch {
      // Text remains available when audio playback is blocked.
    } finally {
      setIsSpeaking(false);
    }
  };

  const send = async (message = input) => {
    const cleaned = message.trim();
    if (!cleaned || isLoading) return;
    stopChatTts();
    const userMessage: ChatMessage = { role: "user", content: cleaned };
    const previous = history.slice(-10);
    setHistory((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await chatWithCompanion(
        itemId || null,
        cleaned,
        previous,
        getVisitedItemIds(window.localStorage),
        getVisitorSessionId()
      );
      const answer = { role: "assistant", content: response.content } as const;
      setHistory((current) => [...current, answer]);
      void speak(response.content);
    } catch {
      setHistory((current) => [
        ...current,
        {
          role: "assistant",
          content: "Đường truyền hơi chập chờn, bạn hỏi lại ta một lần nữa nhé.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const processAudioRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    processAudioRef.current = async () => {
      if (!isRecording) return;
      setIsRecording(false);
      setIsTranscribing(true);
      try {
        const audioBlob = await stopRecording();
        const transcript = await transcribeAudio(audioBlob);
        setInput(transcript);
        await send(transcript);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Không thể nhận diện giọng nói lúc này.";
        alert(message);
      } finally {
        setIsTranscribing(false);
      }
    };
  });

  const toggleMic = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      if (processAudioRef.current) await processAudioRef.current();
      return;
    }

    stopChatTts();
    setIsSpeaking(false);
    try {
      await startRecording(() => {
        if (processAudioRef.current) void processAudioRef.current();
      });
      setIsRecording(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể mở Micro.";
      alert(
        `${message}\n\nVui lòng cấp quyền Micro cho trang web và không mở bằng trình duyệt trong Zalo/Facebook.`
      );
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className={`w-full shrink-0 flex justify-center ${compact ? "mt-2 mb-2" : ""}`}>
        <CompanionAvatar isSpeaking={isSpeaking} size={compact ? "sm" : "lg"} introMode={showIntro} onIntroComplete={onCompleteIntro} />
      </div>

      <div className="relative min-h-0 flex-1 flex flex-col">
        {/* Intro Text Overlay */}
        <div className={`absolute inset-0 flex flex-col items-center justify-start p-6 text-center transition-opacity duration-1000 z-20 ${showIntro ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <h1 className="mt-2 font-serif text-3xl text-amber-100">Chào mừng đến với Quốc Tử Giám</h1>
          <p className="mt-4 text-sm leading-7 text-amber-100/75 max-w-sm">
            Năm nay ta vừa tròn 18, đang chuẩn bị vào thi Đình. Trước khi thi,
            để ta cùng bạn khám phá Quốc Tử Giám nhé!
          </p>
          <button
            type="button"
            onClick={onCompleteIntro}
            className="mt-8 text-sm uppercase tracking-widest text-amber-300/60 underline decoration-amber-300/30 underline-offset-4 transition-transform hover:scale-105"
          >
            Bỏ qua Intro
          </button>
        </div>

        {/* Chat UI */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-1000 ${showIntro ? "opacity-0 pointer-events-none" : "opacity-100 delay-500"}`}>
          <div className="min-h-0 flex-1 flex flex-col px-4 pb-4 pt-2">
            <div className="flex-1 overflow-y-auto space-y-3 companion-chat-scroll">
              {history.map((message, index) => {
                const isLatestAssistant =
                  message.role === "assistant" &&
                  message.content === latestAssistant &&
                  index === history.map((entry) => entry.content).lastIndexOf(latestAssistant);
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === "user"
                          ? "bg-amber-500 text-black"
                          : "border border-amber-200/15 bg-white/[0.06] text-amber-50"
                        }`}
                    >
                      {isLatestAssistant ? streamedAssistant : message.content}
                      {message.role === "assistant" && (
                        <button
                          type="button"
                          onClick={() => void speak(message.content)}
                          className="ml-2 text-amber-300"
                          aria-label="Nghe Lê Quý Đôn đọc"
                        >
                          🔊
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && <p className="text-sm text-amber-200/60">Đôn đang suy nghĩ…</p>}
              {history.length === 0 && (
                <p className="rounded-xl border border-amber-300/15 bg-white/[0.04] p-4 text-center text-sm text-amber-100/70">
                  Hãy hỏi Đôn một câu, hoặc quét một hiện vật để bắt đầu trò chuyện.
                </p>
              )}
              <div ref={endRef} />
            </div>

            {/* Large Glowing Mic Section */}
            {micSupported && !compact && (
              <div className="mt-4 flex flex-col items-center justify-center py-2 shrink-0">
                <div className="flex items-center justify-center gap-8">
                  {/* The Mic */}
                  <div className="relative flex h-24 w-24 items-center justify-center">
                    {/* Outer dashed ring */}
                    <div className={`absolute inset-0 m-auto h-24 w-24 rounded-full border-2 border-dashed border-blue-400/40 ${isRecording ? "animate-[spin_4s_linear_infinite]" : ""}`} />

                    {/* Pulsing rings when listening */}
                    {isRecording && (
                      <>
                        <div className="absolute inset-0 m-auto h-20 w-20 animate-ping rounded-full bg-blue-500/40" />
                        <div className="absolute inset-0 m-auto h-32 w-32 animate-pulse rounded-full bg-blue-400/20" />
                      </>
                    )}

                    {/* Main Button */}
                    <button
                      type="button"
                      onClick={() => void toggleMic()}
                      disabled={isTranscribing}
                      className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all duration-300 disabled:opacity-50 ${isRecording ? "scale-110 shadow-[0_0_40px_rgba(59,130,246,0.8)]" : "hover:scale-105"}`}
                      aria-label={isRecording ? "Dừng ghi âm" : "Nói với Lê Quý Đôn"}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-8 w-8 text-white"
                      >
                        <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 0 1-2 0 3 3 0 0 1-6 0 1 1 0 0 1-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.1A5 5 0 0 0 17 11z" />
                      </svg>
                    </button>
                  </div>

                  {/* The Waveform Effect (Right side) */}
                  {isRecording && (
                    <div className="flex items-center justify-center gap-[3px] h-16 w-48 pl-2">
                      {[...Array(30)].map((_, i) => {
                        const colors = ["bg-teal-400", "bg-cyan-400", "bg-blue-500", "bg-indigo-500", "bg-purple-500"];
                        const colorClass = colors[Math.floor((i / 30) * colors.length)];
                        const animationType = (i % 5) + 1;
                        const delay = (i % 4) * 0.15;
                        const duration = 0.8 + (i % 3) * 0.2;
                        return (
                          <div
                            key={i}
                            className={`w-1 ${colorClass} rounded-full`}
                            style={{ animation: `sound-wave-${animationType} ${duration}s ease-in-out infinite ${delay}s` }}
                          ></div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {isRecording && (
                  <span className="mt-6 text-sm font-medium text-blue-300 animate-pulse drop-shadow-md tracking-wide">Đang lắng nghe...</span>
                )}
                {isTranscribing && (
                  <span className="mt-6 text-sm font-medium text-amber-300 animate-pulse drop-shadow-md tracking-wide">Đang xử lý âm thanh...</span>
                )}
              </div>
            )}
          </div>

          {/* Floating UI */}
          {!showTextInput && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-3 z-50">
              {micSupported && compact && (
                <button
                  type="button"
                  onClick={() => void toggleMic()}
                  disabled={isTranscribing}
                  aria-label={isRecording ? "Dừng ghi âm" : "Nói với Lê Quý Đôn"}
                  className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all ${
                    isRecording
                      ? "bg-blue-600 text-white animate-pulse scale-110 shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                      : "bg-blue-500 text-white hover:scale-105"
                  }`}
                >
                  {isRecording ? (
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400/50 animate-ping"></div>
                  ) : null}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 z-10">
                    <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 0 1-2 0 3 3 0 0 1-6 0 1 1 0 0 1-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.1A5 5 0 0 0 17 11z" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTextInput(true)}
                aria-label="Gõ chữ"
                className="flex items-center justify-center transition-all hover:scale-105 active:scale-95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 36" fill="currentColor" className="w-[36px] h-[18px] text-amber-200/90 hover:text-amber-100">
                  <rect x="2" y="2" width="68" height="32" rx="6" fill="#0b1328" stroke="currentColor" strokeWidth="2" />
                  {/* Top row */}
                  <rect x="6" y="6" width="6" height="4" rx="1" />
                  <rect x="14" y="6" width="6" height="4" rx="1" />
                  <rect x="22" y="6" width="6" height="4" rx="1" />
                  <rect x="30" y="6" width="6" height="4" rx="1" />
                  <rect x="38" y="6" width="6" height="4" rx="1" />
                  <rect x="46" y="6" width="6" height="4" rx="1" />
                  <rect x="54" y="6" width="12" height="4" rx="1" />
                  {/* Middle row */}
                  <rect x="6" y="14" width="10" height="5" rx="1" />
                  <rect x="18" y="14" width="6" height="5" rx="1" />
                  <rect x="26" y="14" width="6" height="5" rx="1" />
                  <rect x="34" y="14" width="6" height="5" rx="1" />
                  <rect x="42" y="14" width="6" height="5" rx="1" />
                  <rect x="50" y="14" width="6" height="5" rx="1" />
                  <rect x="58" y="14" width="8" height="5" rx="1" />
                  {/* Bottom row */}
                  <rect x="6" y="23" width="8" height="5" rx="1" />
                  <rect x="16" y="23" width="6" height="5" rx="1" />
                  <rect x="24" y="23" width="24" height="5" rx="1" /> {/* Spacebar */}
                  <rect x="50" y="23" width="6" height="5" rx="1" />
                  <rect x="58" y="23" width="8" height="5" rx="1" />
                </svg>
              </button>
            </div>
          )}

          {showTextInput && (
            <div className="flex items-center gap-2 border-t border-amber-200/15 bg-black/20 p-3 shrink-0 relative z-50">
              <button
                type="button"
                onClick={() => setShowTextInput(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-amber-100/70 hover:bg-white/[0.1] hover:text-amber-100 transition-colors"
                aria-label="Đóng thanh gõ chữ"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {/* If not compact, we still show the inline mic button just in case, or we rely on the large mic. Actually the previous code had inline mic only for compact. Since we removed inline mic for compact (replaced by floating), we don't need it here. */}
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void send();
                }}
                placeholder="Hỏi Đôn điều gì đó…"
                disabled={isTranscribing || isRecording}
                className="min-w-0 flex-1 rounded-full border border-amber-200/15 bg-white/[0.06] px-4 py-2 text-sm outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={!input.trim() || isLoading}
                onClick={() => void send()}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40 transition-transform active:scale-95"
              >
                Gửi
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
