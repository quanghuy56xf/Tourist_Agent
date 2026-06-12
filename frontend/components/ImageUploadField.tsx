"use client";

import { useRef } from "react";

interface ImageUploadFieldProps {
  label: string;
  angle: string;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
}

export default function ImageUploadField({
  label,
  angle,
  previewUrl,
  onFileSelect,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 px-4 py-3 border border-dashed border-slate-600 rounded-lg hover:border-blue-500 hover:bg-slate-800/50 transition-colors text-sm text-slate-400"
        >
          {previewUrl ? "Đổi ảnh" : "Chọn file / Camera"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
        }}
        data-angle={angle}
      />
      {previewUrl && (
        <img
          src={previewUrl}
          alt={label}
          className="w-full h-32 object-cover rounded-lg border border-slate-700"
        />
      )}
    </div>
  );
}
