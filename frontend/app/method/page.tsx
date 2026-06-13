"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import LoadingOverlay from "@/components/LoadingOverlay";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function MethodSelectionPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    setLoading(true);
    setErrorMsg(null);
    
    try {
      const file = e.target.files[0];
      const compressed = await compressImage(file);
      const response = await searchObject(compressed);
      
      if (response.found && response.results.length > 0) {
        const bestMatch = response.results[0];
        router.push(
          `/item/${bestMatch.item_id}?similarity=${bestMatch.similarity}`
        );
      } else {
        setErrorMsg(t.method.noMatch);
      }
    } catch {
      setErrorMsg(t.method.uploadError);
    } finally {
      setLoading(false);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      <div className="flex-1 max-w-md mx-auto w-full px-6 py-12 flex flex-col">
        {/* Header */}
        <div className="mb-10">
          <button 
            onClick={() => router.push("/")}
            aria-label={t.common.back}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 shadow-sm mb-6"
          >
            &larr;
          </button>
          <h1 className="text-3xl font-black text-slate-800 mb-3 leading-tight">
            {t.method.titleLine1} <br/> {t.method.titleLine2}
          </h1>
          <p className="text-slate-500">{t.method.subtitle}</p>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Options */}
        <div className="w-full space-y-4">
          <button
            onClick={() => router.push("/scan")}
            className="w-full text-left p-5 rounded-2xl bg-white border-2 border-red-100 hover:border-red-300 hover:bg-red-50 transition-all shadow-sm flex items-center gap-4 active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center text-2xl">
              📸
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">{t.method.cameraTitle}</h3>
              <p className="text-sm text-slate-500">{t.method.cameraSubtitle}</p>
            </div>
          </button>

          <button
            onClick={() => document.getElementById("file-upload")?.click()}
            className="w-full text-left p-5 rounded-2xl bg-white border-2 border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm flex items-center gap-4 active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
              🖼️
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">{t.method.uploadTitle}</h3>
              <p className="text-sm text-slate-500">{t.method.uploadSubtitle}</p>
            </div>
          </button>
          <input 
            id="file-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleUpload}
          />

          <button
            onClick={() => router.push("/manual")}
            className="w-full text-left p-5 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-all shadow-sm flex items-center gap-4 active:scale-95"
          >
            <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">{t.method.manualTitle}</h3>
              <p className="text-sm text-slate-500">{t.method.manualSubtitle}</p>
            </div>
          </button>
        </div>
      </div>
      
      {loading && <LoadingOverlay />}
    </div>
  );
}
