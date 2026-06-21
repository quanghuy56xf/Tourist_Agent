"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useVisitorPersona } from "@/components/VisitorPersonaProvider";
import { VisitorPersona } from "@/lib/visitorPersona";

export default function PersonaSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { persona, setPersona } = useVisitorPersona();
  const { t } = useVisitorLocale();

  const options: { value: VisitorPersona; label: string; icon: JSX.Element }[] = [
    {
      value: "Mặc định",
      label: t.persona.general,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      value: "Family Visitor",
      label: t.persona.family,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      value: "Gen Z Explorer",
      label: t.persona.genZ,
      icon: (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative w-fit">
      <div className="inline-flex items-center justify-start rounded-full bg-artifact-secondary/40 border border-artifact-gold/20 p-1 shadow-inner backdrop-blur-sm">
        {options.map((option) => {
          const isSelected = persona === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setPersona(option.value)}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-full py-1.5 px-3 sm:px-4 text-[11px] sm:text-sm font-semibold transition-all duration-300 ${
                isSelected
                  ? "bg-artifact-gold text-artifact-bg shadow-[0_0_12px_rgba(201,168,76,0.5)] scale-100 z-10"
                  : "text-artifact-gold/60 hover:text-artifact-gold hover:bg-artifact-gold/10 scale-95"
              }`}
              aria-pressed={isSelected}
            >
              {option.icon}
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
