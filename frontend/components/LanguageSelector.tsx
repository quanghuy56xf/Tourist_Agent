"use client";

import {
  LOCALE_NATIVE_LABELS,
  VISITOR_LOCALES,
  type VisitorLocale,
} from "@/lib/i18n";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useVisitorLocale();

  return (
    <label
      className={`inline-flex items-center gap-2 ${compact ? "scale-90" : ""}`}
      style={{ color: "var(--muted-foreground)" }}
    >
      <span className="sr-only">{t.home.languageLabel}</span>
      <select
        aria-label={t.home.languageLabel}
        value={locale}
        onChange={(event) => setLocale(event.target.value as VisitorLocale)}
        className="rounded-full px-3 py-1.5 text-base font-semibold outline-none sm:text-xs"
        style={{
          background: "var(--secondary)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        {VISITOR_LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_NATIVE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
