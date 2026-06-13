"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LoadingOverlay() {
  const { t } = useVisitorLocale();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(14,11,7,0.85)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-28 w-28">
          <div
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: "rgba(201,168,76,0.3)" }}
          />
          <div
            className="absolute inset-2 animate-radar rounded-full border-2"
            style={{ borderColor: "rgba(201,168,76,0.25)" }}
          />
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(201,168,76,0.45) 60deg, transparent 120deg)",
              animation: "radar-sweep 2s linear infinite",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full" style={{ background: "var(--primary)" }} />
          </div>
        </div>
        <p className="text-sm animate-pulse" style={{ color: "var(--primary)" }}>
          {t.scan.scanning}
        </p>
      </div>
    </div>
  );
}
