"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CameraCapture from "@/components/CameraCapture";
import LoadingOverlay from "@/components/LoadingOverlay";
import { searchObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function SearchPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCapture = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setFrozen(true);
    setLoading(true);
    setErrorMsg(null);

    try {
      const file = new File([blob], "search.jpg", { type: "image/jpeg" });
      const compressed = await compressImage(file);
      const response = await searchObject(compressed);
      
      if (response.found && response.results.length > 0) {
        const bestMatch = response.results[0];
        router.push(
          `/item/${bestMatch.item_id}?similarity=${bestMatch.similarity}`
        );
      } else {
        setErrorMsg(t.scan.noMatch);
        setFrozen(false);
        if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      }
    } catch {
      setErrorMsg(t.scan.searchError);
      setFrozen(false);
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    } finally {
      setLoading(false);
    }
  };

  const resetCamera = () => {
    setErrorMsg(null);
    setFrozen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* Top UI */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-between p-6">
        <button 
          onClick={() => router.push("/method")}
          aria-label={t.common.back}
          className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-md"
        >
          &larr;
        </button>
        <button className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-md font-bold">
          ?
        </button>
      </div>

      <CameraCapture
        onCapture={handleCapture}
        frozen={frozen}
        capturedUrl={capturedUrl}
      />

      {/* Target Overlay (Dashed Box) */}
      {!frozen && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
          <div className="w-64 h-80 border-2 border-dashed border-white/70 rounded-2xl relative">
            {/* Corner markers could go here */}
          </div>
          <p className="text-white text-sm mt-8 font-medium drop-shadow-md">
            {t.scan.instruction}
          </p>
        </div>
      )}

      {/* Bottom UI */}
      {!frozen && (
        <div className="absolute bottom-10 left-0 right-0 z-20 flex justify-center items-center">
          <div className="relative w-full max-w-md flex justify-center items-center px-8">
            
            {/* Capture Button */}
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={() => {
                  const btn = document.getElementById("camera-capture-btn");
                  if (btn) btn.click();
                }}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-transparent active:scale-95 transition-transform mb-1 shadow-lg"
              >
                <div className="w-16 h-16 rounded-full bg-white"></div>
              </button>
              <span className="text-[12px] font-bold text-white drop-shadow-md">{t.scan.capture}</span>
            </div>
            
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-red-600/90 text-white px-6 py-3 rounded-full text-sm font-medium whitespace-nowrap backdrop-blur-md shadow-lg flex items-center gap-3">
          {errorMsg}
          <button onClick={resetCamera} className="bg-white/20 rounded-full px-2 py-1 text-xs">{t.common.retry}</button>
        </div>
      )}

      {loading && <LoadingOverlay />}
    </div>
  );
}
