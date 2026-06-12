"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonaType = {
  id: string;
  title: string;
  subtitle: string;
  personaStr: string;
  language: string;
  color: string;
};

const personas: PersonaType[] = [
  {
    id: "family",
    title: "Trẻ em / Gia đình",
    subtitle: "Học hỏi và khám phá thật thú vị",
    personaStr: "Family Visitor",
    language: "Tiếng Việt",
    color: "bg-amber-100 border-amber-200 text-amber-900",
  },
  {
    id: "genz",
    title: "Khách khám phá (Gen Z)",
    subtitle: "Khám phá sâu hơn, hiểu hơn, trải nghiệm khác biệt",
    personaStr: "Gen Z Explorer",
    language: "Tiếng Việt",
    color: "bg-green-100 border-green-200 text-green-900",
  },
  {
    id: "international",
    title: "Khách quốc tế (International)",
    subtitle: "Discover, learn and experience in your language",
    personaStr: "Mặc định",
    language: "English",
    color: "bg-blue-100 border-blue-200 text-blue-900",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = () => {
    if (!selected) return;
    const persona = personas.find((p) => p.id === selected);
    if (persona) {
      localStorage.setItem("user_persona", persona.personaStr);
      localStorage.setItem("user_language", persona.language);
      router.push("/method");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <div className="flex-1 max-w-md mx-auto w-full px-6 py-12 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-600 mask mask-squircle mx-auto mb-4 flex items-center justify-center text-white">
            <span className="text-2xl font-bold">⛩️</span>
          </div>
          <h2 className="text-red-700 font-bold uppercase tracking-wider text-sm mb-6">
            Văn Miếu <br /> Quốc Tử Giám
          </h2>
          <h1 className="text-4xl font-black text-slate-800 mb-3 leading-tight">
            Trợ lý ảo <br /> Di tích AI
          </h1>
          <p className="text-slate-500">Khám phá di sản theo cách của riêng bạn</p>
        </div>

        {/* Personas */}
        <div className="w-full space-y-4 mb-8">
          <h3 className="text-center font-bold text-lg mb-4">Tôi là...</h3>
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
              <h4 className="font-bold text-lg mb-1">{p.title}</h4>
              <p className="text-sm opacity-80">{p.subtitle}</p>
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
            BẮT ĐẦU HÀNH TRÌNH →
          </button>
          <div className="text-center pb-2">
            <button 
              onClick={() => router.push('/admin/groups')}
              className="text-slate-400 text-sm hover:text-slate-600 underline underline-offset-2"
            >
              Dành cho Ban quản lý
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
