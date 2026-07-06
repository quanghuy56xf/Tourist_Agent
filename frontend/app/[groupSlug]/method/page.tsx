"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import { useGroupPath } from "@/lib/useGroupPath";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import LanguageSelector from "@/components/LanguageSelector";
import PersonaSelector from "@/components/PersonaSelector";
import VisitorInfoDialog from "@/components/visitor/VisitorInfoDialog";

const methods = [
  { id: "camera", icon: "📸", titleKey: "cameraTitle" as const, subKey: "cameraSubtitle" as const },
  { id: "tour", icon: "🗺️", titleKey: "tourTitle" as const, subKey: "tourSubtitle" as const },
];

export default function MethodSelectionPage() {
  const router = useRouter();
  const scanPath = useGroupPath("/scan");
  const tourPath = useGroupPath("/tour");
  const companionPath = useGroupPath("/companion");
  const { t, locale } = useVisitorLocale();
  const [helpOpen, setHelpOpen] = useState(false);

  const isCompanionSupported = locale === "vi" || locale === "en";

  const handleClick = (id: string) => {
    if (id === "camera") router.push(scanPath);
    else if (id === "companion") router.push(companionPath);
    else if (id === "tour") router.push(tourPath);
  };

  return (
    <main className="flex flex-1 flex-col w-full">
      <header className="artifact-page-head">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 relative z-50">
            <div className="flex items-center gap-2">
              <BackButton onClick={() => router.push("/")} label={t.common.back} />
            </div>
            <div className="flex items-center gap-2">
              <LanguageSelector compact />
            </div>
          </div>
          <div className="w-full pt-1 flex justify-center">
            <PersonaSelector compact />
          </div>
        </div>

        <div className="mb-1 flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)" }}
          >
            <span style={{ color: "var(--primary-foreground)" }}>✦</span>
          </div>
          <span className="artifact-section-label">{t.productName}</span>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <h1 className="font-display min-w-0 text-2xl">
            {t.method.titleLine1}
            <br />
            {t.method.titleLine2}
          </h1>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-amber-200/30 bg-black/20 text-sm font-bold text-amber-100 transition-colors hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label="Hướng dẫn chọn cách bắt đầu khám phá"
            title="Hướng dẫn chọn cách bắt đầu khám phá"
          >
            ?
          </button>
        </div>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.method.subtitle}
        </p>
      </header>

      <div className="artifact-page-body flex-1 space-y-3">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleClick(m.id)}
            className="artifact-card flex w-full items-center gap-4 p-5 text-left transition-transform active:scale-[0.98]"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl"
              style={{ background: "var(--secondary)" }}
            >
              {m.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold">{t.method[m.titleKey]}</h3>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {t.method[m.subKey]}
              </p>
            </div>
          </button>
        ))}

        <button
          type="button"
          onClick={() => handleClick("companion")}
          disabled={!isCompanionSupported}
          className={`artifact-card flex w-full items-center gap-4 p-5 text-left transition-transform relative ${
            isCompanionSupported
              ? "border-amber-400/35 active:scale-[0.98]"
              : "opacity-50 grayscale-[50%]"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15 text-xl">
            📜
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2 flex-wrap">
              {t.method.companionTitle}
              {!isCompanionSupported && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-500/30 whitespace-nowrap">
                  EN & VI Only
                </span>
              )}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {t.method.companionSubtitle}
            </p>
          </div>
        </button>
      </div>

      <VisitorInfoDialog
        open={helpOpen}
        title={t.method.helpTitle}
        description={t.method.helpDescription}
        onClose={() => setHelpOpen(false)}
      >
        <ul className="space-y-2 text-sm leading-relaxed text-amber-100/75">
          <li>• {t.method.helpLang}</li>
          <li>• {t.method.helpPersona}</li>
          <li>• {t.method.helpCompanion}</li>
          <li>• {t.method.helpCamera}</li>
          <li>• {t.method.helpTour}</li>
        </ul>
      </VisitorInfoDialog>
    </main>
  );
}
