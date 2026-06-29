"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface MuteButtonProps {
  className?: string;
  isMuted: boolean;
  onToggle: () => void;
}

export default function MuteButton({ className = "", isMuted, onToggle }: MuteButtonProps) {
  const { t } = useVisitorLocale();
  const label = isMuted ? t.companion.unmute || "Bật tiếng" : t.companion.mute || "Tắt tiếng";

  return (
    <button
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${className}`}
      style={{
        borderColor: "var(--border)",
        background: "var(--secondary)",
        color: "var(--primary)",
      }}
    >
      {isMuted ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
