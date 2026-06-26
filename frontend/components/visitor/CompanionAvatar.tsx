"use client";

import { useEffect, useState } from "react";

interface CompanionAvatarProps {
  isSpeaking: boolean;
  size?: "sm" | "lg";
  collapsed?: boolean;
}

type AvatarState = "idle" | "talk" | "blink";

const SOURCES: Record<AvatarState, string> = {
  idle: "/images/companion/companion-idle.png",
  talk: "/images/companion/companion-talk.png",
  blink: "/images/companion/companion-blink.png",
};

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function CompanionAvatar({
  isSpeaking,
  size = "lg",
  collapsed = false,
  introMode = false,
  onIntroComplete,
}: CompanionAvatarProps & { introMode?: boolean; onIntroComplete?: () => void }) {
  const { t } = useVisitorLocale();
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
        aria-label={t.companion.avatarAlt}
      >
        <img
          src="/images/companion/companion-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        {assetAvailable && (
          <img
            src={SOURCES[state]}
            alt={t.companion.avatarAlt}
            className="absolute inset-0 h-full w-full object-contain"
            onError={() => setAssetAvailable(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 pointer-events-none transition-all duration-500 ease-in-out overflow-hidden transform-gpu ${
        collapsed
          ? "w-16 aspect-square rounded-full shadow-lg mx-auto"
          : introMode
            ? "w-full aspect-square"
            : "w-full aspect-[4/3]"
      }`}
      style={
        introMode && !collapsed
          ? {
              maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
            }
          : {}
      }
      aria-label={t.companion.avatarAlt}
    >
      <img
        src="/images/companion/companion-bg.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      {assetAvailable ? (
        <img
          src={SOURCES[state]}
          alt={t.companion.avatarAlt}
          className={`absolute top-0 left-0 w-full aspect-square object-cover object-top transition-transform duration-500 ease-in-out ${
            !introMode && !collapsed ? "scale-[0.62] origin-top translate-y-[6%]" : "scale-100 origin-top translate-y-0"
          }`}
          onError={() => setAssetAvailable(false)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-amber-100">
          <div className="text-6xl">{t.companion.avatarFallbackName}</div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-300/70">
            {t.companion.avatarAgeLabel}
          </p>
        </div>
      )}
      
      {introMode && !videoFailed && (
        <video
          src="/videos/companion-intro.mp4"
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-top z-10"
          onError={() => {
             setVideoFailed(true);
          }}
        />
      )}
    </div>
  );
}
