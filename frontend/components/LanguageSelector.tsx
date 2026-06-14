"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useVisitorLocale();

  return (
    <div
      role="group"
      aria-label={t.home.languageLabel}
      className={`inline-flex rounded-full p-1 ${compact ? "scale-90" : ""}`}
      style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}
    >
      {(["vi", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className="rounded-full px-3 py-1 text-xs font-bold transition-colors"
          style={{
            background: locale === option ? "var(--primary)" : "transparent",
            color: locale === option ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
