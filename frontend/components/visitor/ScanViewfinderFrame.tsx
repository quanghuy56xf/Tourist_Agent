"use client";

import { ReactNode } from "react";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

interface ScanViewfinderFrameProps {
  children: ReactNode;
  scanning?: boolean;
  scanProgress?: number;
  found?: boolean;
}

function CornerBracket({ position }: { position: string }) {
  const isTop = position.includes("top");
  const isLeft = position.includes("left");

  return (
    <div
      className={`scan-bracket z-10 ${isTop ? "top-3" : "bottom-3"} ${isLeft ? "left-3" : "right-3"}`}
    >
      <div className={`scan-bracket-h ${isLeft ? "left-0" : "right-0"} ${isTop ? "top-0" : "bottom-0"}`} />
      <div className={`scan-bracket-v ${isLeft ? "left-0" : "right-0"} ${isTop ? "top-0" : "bottom-0"}`} />
    </div>
  );
}

export default function ScanViewfinderFrame({
  children,
  scanning,
  scanProgress = 0,
  found,
}: ScanViewfinderFrameProps) {
  const { t } = useVisitorLocale();

  return (
    <div className="relative aspect-square w-full max-w-sm">
      <div
        className="absolute inset-0 overflow-hidden rounded-2xl"
        style={{ border: "1px solid var(--border)", background: "var(--card)" }}
      >
        {children}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 35%, rgba(14,11,7,0.55) 100%)",
          }}
        />
        {scanning && (
          <div
            className="animate-scan-line absolute left-4 right-4 z-20 h-0.5 rounded-full"
            style={{
              background: "var(--primary)",
              boxShadow: "0 0 12px var(--primary)",
            }}
          />
        )}
        {found && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(201,168,76,0.15)" }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--primary)" }}
            >
              <span className="text-2xl" style={{ color: "var(--primary-foreground)" }}>
                ✦
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>
              {t.scan.identified}
            </p>
          </div>
        )}
        {scanning && (
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <div
              className="h-1 overflow-hidden rounded-full"
              style={{ background: "var(--secondary)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(scanProgress, 100)}%`,
                  background: "var(--primary)",
                }}
              />
            </div>
            <p
              className="mt-1.5 text-center text-xs"
              style={{ color: "var(--primary)" }}
            >
              {t.scan.analyzing} {Math.round(Math.min(scanProgress, 100))}%
            </p>
          </div>
        )}
      </div>

      {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
        <CornerBracket key={pos} position={pos} />
      ))}
    </div>
  );
}
