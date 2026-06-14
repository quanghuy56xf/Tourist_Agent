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
      <label className="admin-label">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="admin-upload-zone flex-1 py-4"
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
          className="h-32 w-full rounded-xl border object-cover"
          style={{ borderColor: "var(--border)" }}
        />
      )}
    </div>
  );
}
