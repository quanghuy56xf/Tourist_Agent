"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chatWithCompanion, ChatMessage } from "@/lib/api";
import { playChatTts, stopChatTts } from "@/lib/chatTts";
import { getVisitedItemIds } from "@/lib/companionState";
import { rememberMinimapSuggestion } from "@/lib/minimapState";
import { getVisitorSessionId } from "@/lib/visitorAnalytics";
import { useGroupSlug } from "@/lib/useGroupPath";
import {
  isVoiceInputSupported,
  startListening,
  stopListening,
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
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestionRequested, setSuggestionRequested] = useState(false);
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
      stopListening();
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

    if (!itemId) {
      setTimeout(() => {
        const fallbackMsg = "Bạn hãy bấm nút Quét để chọn một hiện vật trước nhé, lúc đó ta mới có thể kể cho bạn nghe nhiều câu chuyện thú vị được!";
        setHistory((current) => [...current, { role: "assistant", content: fallbackMsg }]);
        void speak(fallbackMsg);
        setIsLoading(false);
      }, 800);
      return;
    }

    try {
      const response = await chatWithCompanion(
        itemId,
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

  const toggleMic = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }
    
    // On iOS, starting the mic while audio is playing will immediately throw 'aborted'.
    // We must stop any playing TTS first.
    stopChatTts();
    setIsSpeaking(false);

    startListening(
      (text) => {
        setInput(text);
        setIsListening(false);
        void send(text);
      },
      (errorEvent: any) => {
        setIsListening(false);
        const errCode = errorEvent?.error || errorEvent?.message || JSON.stringify(errorEvent);
        console.error("Speech Recognition Error:", errorEvent);
        alert(
          `Không thể mở Micro (Mã lỗi: ${errCode}).\n\nVui lòng đảm bảo:\n1. Bạn đang mở web bằng Chrome/Safari (Không dùng trình duyệt trong Zalo/Facebook).\n2. Bạn đã cấp quyền Micro cho trang web này.`
        );
      },
      () => setIsListening(false)
    );
    setIsListening(true);
  };

  return (
    <section className={`flex min-h-0 flex-col ${compact ? "" : "flex-1"}`}>
      <div className="w-full shrink-0">
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
            <div className="flex-1 overflow-y-auto space-y-3">
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
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 ${
                        message.role === "user"
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
            {micSupported && (
              <div className="mt-2 flex flex-col items-center justify-center py-1 shrink-0">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  {/* Outer dashed ring */}
                  <div className={`absolute inset-0 m-auto h-16 w-16 rounded-full border-2 border-dashed border-blue-400/30 ${isListening ? "animate-[spin_4s_linear_infinite]" : ""}`} />
                  
                  {/* Pulsing rings when listening */}
                  {isListening && (
                    <>
                      <div className="absolute inset-0 m-auto h-14 w-14 animate-ping rounded-full bg-blue-500/40" />
                      <div className="absolute inset-0 m-auto h-20 w-20 animate-pulse rounded-full bg-blue-400/10" />
                    </>
                  )}

                  {/* Main Button */}
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-transform duration-300 ${isListening ? "scale-110" : "hover:scale-105"}`}
                    aria-label={isListening ? "Dừng nghe" : "Nói với Lê Quý Đôn"}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-5 w-5 text-white"
                    >
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a1 1 0 0 1-2 0 3 3 0 0 1-6 0 1 1 0 0 1-2 0 5 5 0 0 0 4 4.9V19H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-3.1A5 5 0 0 0 17 11z" />
                    </svg>
                  </button>
                </div>
                {isListening && <span className="mt-3 text-xs text-blue-300 animate-pulse">Đang nghe...</span>}
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t border-amber-200/15 bg-black/20 p-3 shrink-0">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void send();
              }}
              placeholder="Hỏi Đôn điều gì đó…"
              className="min-w-0 flex-1 rounded-full border border-amber-200/15 bg-white/[0.06] px-4 text-sm outline-none"
            />
            <button
              type="button"
              disabled={!input.trim() || isLoading}
              onClick={() => void send()}
              className="rounded-full bg-amber-500 px-4 text-sm font-semibold text-black disabled:opacity-40 transition-transform active:scale-95"
            >
              Gửi
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
