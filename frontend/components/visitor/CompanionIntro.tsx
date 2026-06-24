"use client";

import { useState } from "react";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import CompanionAvatar from "./CompanionAvatar";

export default function CompanionIntro({ onComplete }: { onComplete: () => void }) {
  const { t } = useVisitorLocale();
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b1328] text-amber-50">
      <div
        className="relative w-full aspect-square shrink-0 pointer-events-none"
        style={{
          maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
        }}
      >
        {!videoFailed ? (
          <video
            src="/videos/companion-intro.mp4"
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            onEnded={onComplete}
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <CompanionAvatar isSpeaking={false} />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-start p-6 text-center animate-in fade-in duration-1000">
        <h1 className="mt-2 font-serif text-3xl text-amber-100">{t.companion.introTitle}</h1>
        <p className="mt-4 text-sm leading-7 text-amber-100/75 max-w-sm">
          {t.companion.introSubtitle}
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-8 text-sm uppercase tracking-widest text-amber-300/60 underline decoration-amber-300/30 underline-offset-4"
        >
          {t.companion.skipIntro}
        </button>
      </div>
    </div>
  );
}
