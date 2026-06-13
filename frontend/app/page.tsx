"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LanguageSelector from "@/components/LanguageSelector";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type PersonaType = {
  id: "family" | "genz" | "international";
  personaStr: "Family Visitor" | "Gen Z Explorer" | "Mặc định";
  color: string;
};

const personas: PersonaType[] = [
  {
    id: "family",
    personaStr: "Family Visitor",
    color: "bg-amber-100 border-amber-200 text-amber-900",
  },
  {
    id: "genz",
    personaStr: "Gen Z Explorer",
    color: "bg-green-100 border-green-200 text-green-900",
  },
  {
    id: "international",
    personaStr: "Mặc định",
    color: "bg-blue-100 border-blue-200 text-blue-900",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const personaCopy = {
    family: [t.home.familyTitle, t.home.familySubtitle],
    genz: [t.home.genZTitle, t.home.genZSubtitle],
    international: [
      t.home.internationalTitle,
      t.home.internationalSubtitle,
    ],
  };

  const handleStart = () => {
    if (!selected) return;
    const persona = personas.find((p) => p.id === selected);
    if (persona) {
      localStorage.setItem("user_persona", persona.personaStr);
      router.push("/method");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <div className="flex-1 max-w-md mx-auto w-full px-6 py-12 flex flex-col items-center">
        <div className="mb-4 flex w-full justify-end">
          <LanguageSelector />
        </div>
        {/* Header */}
        <div className="text-center mb-10">
          <Image
            src="/hera-app-icon.png"
            alt="HERA"
            width={128}
            height={128}
            priority
            className="mx-auto mb-4 h-28 w-28 rounded-3xl object-cover shadow-lg"
          />
          <h2 className="mb-5 bg-gradient-to-r from-red-800 via-red-600 to-amber-500 bg-clip-text text-5xl font-black uppercase tracking-[0.16em] text-transparent drop-shadow-sm">
            {t.home.siteName}
          </h2>
          <p className="text-slate-500">{t.home.subtitle}</p>
        </div>

        {/* Personas */}
        <div className="w-full space-y-4 mb-8">
          <h3 className="text-center font-bold text-lg mb-4">
            {t.home.audiencePrompt}
          </h3>
          {personas.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                p.color
              } ${
                selected === p.id
                  ? "ring-4 ring-red-500/30 border-red-500 scale-[1.02]"
                  : "hover:scale-[1.01]"
              }`}
            >
              <h4 className="font-bold text-lg mb-1">{personaCopy[p.id][0]}</h4>
              <p className="text-sm opacity-80">{personaCopy[p.id][1]}</p>
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto w-full pt-6">
          <button
            onClick={handleStart}
            disabled={!selected}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-full text-lg shadow-lg shadow-red-500/30 transition-all active:scale-95 mb-4"
          >
            {t.home.start}
          </button>
          <div className="text-center pb-2">
            <button 
              onClick={() => router.push('/admin/groups')}
              className="text-slate-400 text-sm hover:text-slate-600 underline underline-offset-2"
            >
              {t.home.management}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
