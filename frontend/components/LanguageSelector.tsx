"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LanguageSelector() {
  const { locale, setLocale, t } = useVisitorLocale();

  return (
    <div
      role="group"
      aria-label={t.home.languageLabel}
      className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
    >
      {(["vi", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
            locale === option
              ? "bg-red-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
