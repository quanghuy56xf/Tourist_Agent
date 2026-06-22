"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CompanionChat from "@/components/visitor/CompanionChat";
import HomeButton from "@/components/visitor/HomeButton";
import MinimapModal from "@/components/visitor/MinimapModal";
import {
  enableCompanionMode,
  hasSeenCompanionIntro,
  markCompanionIntroSeen,
} from "@/lib/companionState";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";

export default function CompanionPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const scanPath = useGroupPath("/scan");
  const [showIntro, setShowIntro] = useState(false);
  const [ready, setReady] = useState(false);
  const [minimapSuggestedId, setMinimapSuggestedId] = useState<number | null>(null);

  useEffect(() => {
    enableCompanionMode(window.sessionStorage);
    setShowIntro(!hasSeenCompanionIntro(window.sessionStorage));
    setReady(true);
  }, []);

  const completeIntro = () => {
    markCompanionIntroSeen(window.sessionStorage);
    setShowIntro(false);
  };

  if (!ready) return null;

  return (
    <main className="relative flex min-h-[100dvh] flex-1 flex-col bg-[#0b1328] text-amber-50">
      <header className="absolute left-0 right-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-[#0b1328]/90 via-[#0b1328]/50 to-transparent px-4 py-4 pt-6 pointer-events-none">
        <div className="pointer-events-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
            Người bạn đồng hành
          </p>
          <h1 className="font-serif text-2xl text-amber-50 drop-shadow-md">
            Lê Quý Đôn
          </h1>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <HomeButton />
          <button
            type="button"
            onClick={() => router.push(scanPath)}
            className="flex h-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 text-sm font-semibold text-amber-400 backdrop-blur-md transition-transform active:scale-95"
          >
            📸 Quét
          </button>
        </div>
      </header>
      <CompanionChat 
        showIntro={showIntro} 
        onCompleteIntro={completeIntro} 
        onSuggestNextPoint={(id) => setMinimapSuggestedId(id)}
      />

      <MinimapModal
        isOpen={minimapSuggestedId !== null}
        onClose={() => setMinimapSuggestedId(null)}
        groupSlug={groupSlug}
        suggestedItemId={minimapSuggestedId || undefined}
      />
    </main>
  );
}
