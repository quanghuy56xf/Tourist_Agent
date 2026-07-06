"use client";

import { useEffect, useState } from "react";
import CompanionChat from "@/components/visitor/CompanionChat";
import HomeButton from "@/components/visitor/HomeButton";
import MuteButton from "@/components/visitor/MuteButton";
import SpeedButton from "@/components/visitor/SpeedButton";
import MinimapModal from "@/components/visitor/MinimapModal";
import VisitorInfoDialog from "@/components/visitor/VisitorInfoDialog";
import {
  enableCompanionMode,
  hasSeenCompanionIntro,
  markCompanionIntroSeen,
} from "@/lib/companionState";
import { useGroupSlug } from "@/lib/useGroupPath";
import { getDynamicMinimapConfig, type MinimapConfig } from "@/lib/api";
import { VISITOR_GROUP_ID_KEY } from "@/lib/groupSlug";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function CompanionPage() {
  const groupSlug = useGroupSlug();
  const { t } = useVisitorLocale();
  const [showIntro, setShowIntro] = useState(false);
  const [ready, setReady] = useState(false);
  const [minimapSuggestedId, setMinimapSuggestedId] = useState<number | null>(null);
  const [minimapSuggestedName, setMinimapSuggestedName] = useState<string | null>(null);
  const [config, setConfig] = useState<MinimapConfig | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [companionHelpOpen, setCompanionHelpOpen] = useState(false);

  useEffect(() => {
    enableCompanionMode(window.sessionStorage);
    setShowIntro(!hasSeenCompanionIntro(window.sessionStorage));
    setReady(true);
    
    let cancelled = false;
    const groupId = Number(window.localStorage.getItem(VISITOR_GROUP_ID_KEY));
    if (Number.isInteger(groupId) && groupId > 0) {
      void getDynamicMinimapConfig(groupId)
        .then((nextConfig) => {
          if (!cancelled) setConfig(nextConfig);
        })
        .catch(() => {
          if (!cancelled) setConfig(null);
        });
    }
    return () => { cancelled = true; };
  }, []);

  const completeIntro = () => {
    markCompanionIntroSeen(window.sessionStorage);
    setShowIntro(false);
  };

  if (!ready) return null;

  return (
    <div className="flex min-h-[100dvh] w-full justify-center bg-[#050914]">
      <main className="relative flex min-h-[100dvh] w-full max-w-md flex-col overflow-x-hidden overflow-y-hidden bg-[#0b1328] text-amber-50 shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:border-x sm:border-amber-900/30">
      <header className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-[#0b1328]/90 via-[#0b1328]/50 to-transparent px-4 py-4 pt-6 pointer-events-none">
        <div className="pointer-events-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
            {t.companion.role}
          </p>
          <h1 className="font-serif text-2xl text-amber-50 drop-shadow-md">
            {t.companion.name}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompanionHelpOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-full border border-amber-300/40 bg-[#251b0e]/95 text-sm font-bold text-amber-200 shadow-lg shadow-black/35 backdrop-blur transition hover:scale-105 hover:bg-[#332614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              aria-label={t.companion.helpAria}
              title={t.companion.helpAria}
            >
              ?
            </button>
            <HomeButton />
          </div>
          <div className="flex gap-2">
            <SpeedButton
              speed={playbackRate}
              onToggle={() => setPlaybackRate((current) => (current === 1 ? 1.5 : current === 1.5 ? 2 : 1))}
            />
            <MuteButton isMuted={isMuted} onToggle={() => setIsMuted((prev) => !prev)} />
          </div>
        </div>
      </header>
      <CompanionChat
        showIntro={showIntro}
        onCompleteIntro={completeIntro}
        onSuggestNextPoint={(id, name) => {
          setMinimapSuggestedId(id);
          if (name) setMinimapSuggestedName(name);
        }}
        isMuted={isMuted}
        playbackRate={playbackRate}
      />

      <VisitorInfoDialog
        open={companionHelpOpen}
        title={t.companion.helpTitle}
        description={t.companion.helpDesc}
        onClose={() => setCompanionHelpOpen(false)}
      >
        <ul className="space-y-2 text-sm leading-relaxed text-amber-100/75">
          <li>• {t.companion.helpPoint1}</li>
          <li>• {t.companion.helpPoint2}</li>
          <li>• {t.companion.helpPoint3}</li>
          <li>• {t.companion.helpPoint4}</li>
          <li className="text-amber-300 font-medium pt-1 border-t border-amber-500/20 mt-2">
            • {t.companion.helpDevNote}
          </li>
        </ul>
      </VisitorInfoDialog>

      <MinimapModal
        open={minimapSuggestedId !== null}
        onClose={() => {
          setMinimapSuggestedId(null);
          setMinimapSuggestedName(null);
        }}
        groupSlug={groupSlug}
        config={config}
        suggestedItemId={minimapSuggestedId || null}
        suggestedItemName={minimapSuggestedName}
      />
      </main>
    </div>
  );
}
