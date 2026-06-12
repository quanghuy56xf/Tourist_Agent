"use client";

import { useState } from "react";
import CameraCapture from "@/components/CameraCapture";
import LoadingOverlay from "@/components/LoadingOverlay";
import ResultModal from "@/components/ResultModal";
import { searchObject, SearchResponse } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";

export default function SearchPage() {
  const [frozen, setFrozen] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);

  const handleCapture = async (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setCapturedUrl(url);
    setFrozen(true);
    setLoading(true);

    try {
      const file = new File([blob], "search.jpg", { type: "image/jpeg" });
      const compressed = await compressImage(file);
      const response = await searchObject(compressed);
      setResult(response);
    } catch {
      setResult({
        found: false,
        results: [],
        message: "Lỗi khi tìm kiếm. Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setFrozen(false);
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quét tìm vật thể</h1>
        <p className="text-slate-400 text-sm mt-1">
          Hướng camera vào vật thể và nhấn nút quét
        </p>
      </div>

      <CameraCapture
        onCapture={handleCapture}
        frozen={frozen}
        capturedUrl={capturedUrl}
      />

      {loading && <LoadingOverlay />}
      {result && (
        <ResultModal
          found={result.found}
          results={result.results}
          message={result.message}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
