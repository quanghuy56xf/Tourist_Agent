"use client";

import { useState, useRef, useEffect } from "react";
import {
  LOCALE_NATIVE_LABELS,
  VISITOR_LOCALES,
  type VisitorLocale,
} from "@/lib/i18n";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useVisitorLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
    <div 
      ref={dropdownRef} 
      className={`relative inline-block text-left ${compact ? "origin-top-right scale-90" : ""}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t.home.languageLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-full bg-artifact-secondary/60 border border-artifact-secondary/80 px-4 py-1.5 text-sm font-medium text-artifact-fg outline-none transition-all hover:bg-artifact-secondary hover:border-artifact-muted/50 focus:ring-2 focus:ring-artifact-gold/30 backdrop-blur-sm"
      >
        <span>{LOCALE_NATIVE_LABELS[locale]}</span>
        <svg 
          className={`h-4 w-4 text-artifact-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24" 
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Custom Dropdown Menu */}
      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-max min-w-full origin-top-right rounded-xl border border-artifact-secondary/80 bg-artifact-card/95 backdrop-blur-md py-1 shadow-xl shadow-black/50 focus:outline-none z-50 overflow-hidden"
        >
          {VISITOR_LOCALES.map((option) => (
            <li
              key={option}
              role="option"
              aria-selected={locale === option}
              onClick={() => {
                setLocale(option);
                setIsOpen(false);
              }}
              className={`cursor-pointer px-4 py-2 text-sm transition-colors hover:bg-artifact-secondary ${
                locale === option 
                  ? "bg-artifact-secondary/80 text-artifact-gold font-semibold" 
                  : "text-artifact-fg"
              }`}
            >
              {LOCALE_NATIVE_LABELS[option]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
