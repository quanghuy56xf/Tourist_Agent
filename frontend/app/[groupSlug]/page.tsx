"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LanguageSelector from "@/components/LanguageSelector";
import { useGroupPath } from "@/lib/useGroupPath";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";
import { VISITOR_GROUP_NAME_KEY } from "@/lib/groupSlug";
import { readStoredGroupId, trackVisitorEvent } from "@/lib/visitorAnalytics";

type PersonaType = {
  id: "family" | "genz" | "international";
  personaStr: "Family Visitor" | "Gen Z Explorer" | "Mặc định";
};

const personas: PersonaType[] = [
  { id: "family", personaStr: "Family Visitor" },
  { id: "genz", personaStr: "Gen Z Explorer" },
  { id: "international", personaStr: "Mặc định" },
];

export default function GroupHomePage() {
  const router = useRouter();
  const groupMethodPath = useGroupPath("/method");
  const { t } = useVisitorLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    setGroupName(localStorage.getItem(VISITOR_GROUP_NAME_KEY) || "");
    const groupId = readStoredGroupId();
    if (groupId) {
      void trackVisitorEvent("group_visit", { groupId });
    }
  }, []);

  const personaCopy = {
    family: [t.home.familyTitle, t.home.familySubtitle],
    genz: [t.home.genZTitle, t.home.genZSubtitle],
    international: [t.home.internationalTitle, t.home.internationalSubtitle],
  };

  const handleStart = () => {
    if (!selected) return;
    const persona = personas.find((p) => p.id === selected);
    if (persona) {
      localStorage.setItem("user_persona", persona.personaStr);
      router.push(groupMethodPath);
    }
  };

  return (
    <div className="artifact-shell artifact-shell-pad">
      <div className="mb-6 flex items-center justify-end gap-3">
        <LanguageSelector />
      </div>

      <header className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)" }}
          >
            <span style={{ color: "var(--primary-foreground)" }}>✦</span>
          </div>
          <span className="text-2xl font-bold uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>{groupName || t.home.siteName}</span>
        </div>
        <Image
          src="/hera-app-icon.png"
          alt="HERA"
          width={192}
          height={192}
          priority
          className="mx-auto mb-4 h-48 w-48 rounded-2xl object-cover"
        />
        <h1 className="font-display text-3xl" style={{ color: "var(--foreground)" }}>
          {t.home.headline}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.home.subtitle}
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-4 text-center text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {t.home.audiencePrompt}
        </h2>
        <div className="space-y-2">
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className="w-full rounded-xl p-4 text-left transition-all active:scale-[0.98]"
              style={{
                background:
                  selected === p.id ? "var(--primary)" : "var(--secondary)",
                color:
                  selected === p.id ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border:
                  selected === p.id
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
              }}
            >
              <h3 className="text-sm font-bold">{personaCopy[p.id][0]}</h3>
              <p className="mt-1 text-xs opacity-90">{personaCopy[p.id][1]}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto">
        <button
          type="button"
          onClick={handleStart}
          disabled={!selected}
          className="artifact-btn-primary w-full"
        >
          {t.home.start}
        </button>
      </div>
    </div>
  );
}
