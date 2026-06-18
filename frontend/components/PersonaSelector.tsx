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

  return (
    <select
      aria-label={t.persona.label}
      value={persona}
      onChange={(event) => setPersona(event.target.value as VisitorPersona)}
      className={`rounded-full px-3 py-2 text-xs font-bold outline-none ${
        compact ? "max-w-36" : ""
      }`}
      style={{
        background: "var(--secondary)",
        border: "1px solid var(--border)",
        color: "var(--foreground)",
      }}
    >
      <option value="Mặc định">{t.persona.general}</option>
      <option value="Family Visitor">{t.persona.family}</option>
      <option value="Gen Z Explorer">{t.persona.genZ}</option>
    </select>
  );
}
