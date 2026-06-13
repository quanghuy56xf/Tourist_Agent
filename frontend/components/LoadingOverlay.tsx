"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LoadingOverlay() {
  const { t } = useVisitorLocale();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/30" />
          <div className="absolute inset-2 rounded-full border-2 border-blue-500/20 animate-radar" />
          <div className="absolute inset-4 rounded-full border-2 border-blue-500/10 animate-radar" style={{ animationDelay: "0.5s" }} />
          <div
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(59,130,246,0.4) 60deg, transparent 120deg)",
              animation: "radar-sweep 2s linear infinite",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
          </div>
        </div>
        <p className="text-sm text-slate-300 animate-pulse">{t.scan.scanning}</p>
      </div>
    </div>
  );
}
