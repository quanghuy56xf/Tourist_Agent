"use client";

import { useEffect, useState } from "react";

interface CompanionAvatarProps {
  isSpeaking: boolean;
  size?: "sm" | "lg";
}

type AvatarState = "idle" | "talk" | "blink";

const SOURCES: Record<AvatarState, string> = {
  idle: "/images/companion/companion-idle.png",
  talk: "/images/companion/companion-talk.png",
  blink: "/images/companion/companion-blink.png",
};

export default function CompanionAvatar({
  isSpeaking,
  size = "lg",
  introMode = false,
  onIntroComplete,
}: CompanionAvatarProps & { introMode?: boolean; onIntroComplete?: () => void }) {
  const [state, setState] = useState<AvatarState>("idle");
  const [assetAvailable, setAssetAvailable] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    if (isSpeaking) {
      const timer = window.setInterval(() => {
        setState((current) => (current === "talk" ? "idle" : "talk"));
      }, 150);
      return () => window.clearInterval(timer);
    }

    setState("idle");
    let timeout: number;
    const scheduleBlink = () => {
      timeout = window.setTimeout(() => {
        setState("blink");
        window.setTimeout(() => setState("idle"), 180);
        scheduleBlink();
      }, 3000 + Math.random() * 3000);
    };
    scheduleBlink();
    return () => window.clearTimeout(timeout);
  }, [isSpeaking]);

  if (size === "sm") {
    return (
      <div
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-amber-300/35 shadow-xl"
        aria-label="Lê Quý Đôn thời trẻ"
      >
        <img
          src="/images/companion/companion-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {assetAvailable && (
          <img
            src={SOURCES[state]}
            alt="Minh họa Lê Quý Đôn 18 tuổi"
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setAssetAvailable(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full aspect-[4/3] shrink-0 pointer-events-none"
      style={{
        maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
      }}
      aria-label="Lê Quý Đôn thời trẻ"
    >
      <img
        src="/images/companion/companion-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      {assetAvailable ? (
        <img
          src={SOURCES[state]}
          alt="Minh họa Lê Quý Đôn 18 tuổi"
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={() => setAssetAvailable(false)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-amber-100">
          <div className="text-6xl">Đôn</div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-300/70">
            18 tuổi
          </p>
        </div>
      )}
      
      {introMode && !videoFailed && (
        <video
          src="/videos/companion-intro.mp4"
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-top z-10"
          onEnded={onIntroComplete}
          onError={() => {
             setVideoFailed(true);
             if (onIntroComplete) onIntroComplete();
          }}
        />
      )}
    </div>
  );
}
