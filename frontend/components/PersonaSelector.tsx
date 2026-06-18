"use client";

import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { useVisitorPersona } from "@/components/VisitorPersonaProvider";
import { VisitorPersona } from "@/lib/visitorPersona";
import { useState, useRef, useEffect } from "react";

export default function PersonaSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { persona, setPersona } = useVisitorPersona();
  const { t } = useVisitorLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options: { value: VisitorPersona; label: string }[] = [
    { value: "Mặc định", label: t.persona.general },
    { value: "Family Visitor", label: t.persona.family },
    { value: "Gen Z Explorer", label: t.persona.genZ },
  ];

  const selectedOption = options.find((opt) => opt.value === persona) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${compact ? "max-w-[200px]" : "w-full min-w-[160px]"}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 rounded-full border border-artifact-gold/60 bg-artifact-secondary/50 px-4 py-2 text-sm font-bold text-artifact-gold shadow-[0_0_15px_rgba(201,168,76,0.15)] backdrop-blur transition-all duration-300 hover:border-artifact-gold hover:bg-artifact-secondary hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] focus:outline-none focus:ring-2 focus:ring-artifact-gold focus:ring-offset-2 focus:ring-offset-artifact-bg"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-artifact-gold/80 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-artifact-gold/30 bg-artifact-card/95 py-2 shadow-xl shadow-black/60 backdrop-blur-md focus:outline-none">
          <ul role="listbox" className="max-h-60 overflow-auto">
            {options.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={persona === option.value}
                onClick={() => {
                  setPersona(option.value);
                  setIsOpen(false);
                }}
                className={`group relative flex cursor-pointer select-none items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  persona === option.value
                    ? "bg-artifact-gold/15 text-artifact-gold font-semibold"
                    : "text-artifact-fg hover:bg-artifact-secondary/80 hover:text-white"
                }`}
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${persona === option.value ? "border-artifact-gold bg-artifact-gold/20" : "border-artifact-muted/30 group-hover:border-artifact-muted"}`}>
                  {persona === option.value && (
                    <div className="h-2 w-2 rounded-full bg-artifact-gold" />
                  )}
                </div>
                <span className="truncate">{option.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
