"use client";

import { useEffect, useState } from "react";
import CompanionChat from "@/components/visitor/CompanionChat";
import HomeButton from "@/components/visitor/HomeButton";
import MinimapModal from "@/components/visitor/MinimapModal";
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
        <div className="flex gap-2 pointer-events-auto">
          <HomeButton />
        </div>
      </header>
      <CompanionChat
        showIntro={showIntro}
        onCompleteIntro={completeIntro}
        onSuggestNextPoint={(id, name) => {
          setMinimapSuggestedId(id);
          if (name) setMinimapSuggestedName(name);
        }}
      />

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
