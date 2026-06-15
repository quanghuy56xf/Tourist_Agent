"use client";

import { useState } from "react";
import { playChatTts } from "@/lib/chatTts";

interface ChatAssistantBubbleProps {
  content: string;
  language: string;
  speakLabel: string;
  onBeforeSpeak?: () => void;
}

export default function ChatAssistantBubble({
  content,
  language,
  speakLabel,
  onBeforeSpeak,
}: ChatAssistantBubbleProps) {
  const [loading, setLoading] = useState(false);

  const handleSpeak = async () => {
    if (loading || !content.trim()) return;
    onBeforeSpeak?.();
    setLoading(true);
    try {
      await playChatTts(content, language);
    } catch {
      /* ignore playback errors */
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative max-w-[88%] rounded-2xl px-4 py-3 pr-12 text-sm leading-relaxed"
      style={{
        background: "var(--card)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
      }}
    >
      {content.trim() && (
        <button
          type="button"
          onClick={() => void handleSpeak()}
          disabled={loading}
          aria-label={speakLabel}
          title={speakLabel}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-xs disabled:opacity-70"
          style={{
            background: "rgba(14, 11, 7, 0.55)",
            color: "var(--primary)",
            border: "1px solid var(--border)",
          }}
        >
          {loading ? "…" : "🔊"}
        </button>
      )}
      {content}
    </div>
  );
}
