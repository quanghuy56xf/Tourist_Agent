"use client";

import { useEffect, useState } from "react";
import {
  isBrowserSpeechSupported,
  isSpeechCancelled,
  speakWithBrowser,
  stopBrowserSpeech,
} from "@/lib/browserSpeech";

interface ChatAssistantBubbleProps {
  content: string;
  language: string;
  speakLabel: string;
  stopSpeakLabel: string;
  onBeforeSpeak?: () => void;
}

export default function ChatAssistantBubble({
  content,
  language,
  speakLabel,
  stopSpeakLabel,
  onBeforeSpeak,
}: ChatAssistantBubbleProps) {
  const [speechReady, setSpeechReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSpeechReady(isBrowserSpeechSupported());
  }, []);

  useEffect(() => {
    return () => {
      stopBrowserSpeech();
    };
  }, []);

  const handleToggleSpeak = async () => {
    if (!speechReady) return;

    if (speaking) {
      stopBrowserSpeech();
      setSpeaking(false);
      return;
    }

    onBeforeSpeak?.();
    setSpeaking(true);
    try {
      await speakWithBrowser(content, language);
    } catch (error) {
      if (!isSpeechCancelled(error)) {
        /* ignore other playback errors */
      }
    } finally {
      setSpeaking(false);
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
      {speechReady && (
        <button
          type="button"
          onClick={() => void handleToggleSpeak()}
          aria-label={speaking ? stopSpeakLabel : speakLabel}
          title={speaking ? stopSpeakLabel : speakLabel}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-xs"
          style={{
            background: speaking ? "rgba(212,24,61,0.85)" : "rgba(14, 11, 7, 0.55)",
            color: speaking ? "#f0e8d5" : "var(--primary)",
            border: speaking
              ? "1px solid rgba(212,24,61,0.55)"
              : "1px solid var(--border)",
          }}
        >
          {speaking ? "⏹" : "🔊"}
        </button>
      )}
      {content}
    </div>
  );
}
