"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ImagePreviewGrid from "@/components/ImagePreviewGrid";
import ImageUploadField from "@/components/ImageUploadField";
import { ActiveGroup, getActiveGroup } from "@/lib/activeGroup";
import { registerObject } from "@/lib/api";
import { compressImage } from "@/lib/imageCompress";

type Angle = "front" | "side" | "back";

const ANGLE_LABELS: Record<Angle, string> = {
  front: "Ảnh mặt trước",
  side: "Ảnh mặt bên",
  back: "Ảnh mặt sau",
};

export default function RegisterPage() {
  const [activeGroup, setActiveGroupState] = useState<ActiveGroup | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<Partial<Record<Angle, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Angle, string>>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const refreshActiveGroup = useCallback(() => {
    setActiveGroupState(getActiveGroup());
  }, []);

  useEffect(() => {
    refreshActiveGroup();
    const onChange = () => refreshActiveGroup();
    window.addEventListener("active-group-changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("active-group-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refreshActiveGroup]);

  const handleFileSelect = useCallback(async (angle: Angle, file: File) => {
    const compressed = await compressImage(file);
    const compressedFile = new File([compressed], `${angle}.jpg`, {
      type: "image/jpeg",
    });

    setFiles((prev) => ({ ...prev, [angle]: compressedFile }));
    setPreviews((prev) => {
      if (prev[angle]) URL.revokeObjectURL(prev[angle]!);
      return { ...prev, [angle]: URL.createObjectURL(compressed) };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!activeGroup) {
      setMessage({
        type: "error",
        text: "Chưa chọn nhóm. Vào Quản lý nhóm để chọn nhóm trước.",
      });
      return;
    }
    if (!name.trim() || !description.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập tên và mô tả" });
      return;
    }
    if (!files.front) {
      setMessage({ type: "error", text: "Ảnh mặt trước là bắt buộc" });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("main_image", files.front);
      if (files.side) formData.append("side_image", files.side);
      if (files.back) formData.append("back_image", files.back);
      formData.append("group_id", String(activeGroup.id));

      const result = await registerObject(formData);
      setMessage({
        type: "success",
        text: `Đăng ký thành công vào nhóm "${activeGroup.name}"! ID: ${result.item_id}`,
      });
      setName("");
      setDescription("");
      setFiles({});
      Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
      setPreviews({});
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Đăng ký thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const previewItems = (["front", "side", "back"] as Angle[])
    .filter((a) => previews[a])
    .map((a) => ({
      angle: a,
      label: ANGLE_LABELS[a],
      url: previews[a]!,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Đăng ký vật thể</h1>
        <p className="text-slate-400 text-sm mt-1">
          Tải ảnh nhiều góc cho vật thể. Nhóm được chọn tại{" "}
          <Link href="/admin/groups" className="text-blue-400 hover:underline">
            Quản lý nhóm
          </Link>
          .
        </p>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <p className="text-sm text-slate-400 mb-1">Nhóm đăng ký</p>
        {activeGroup ? (
          <p className="text-lg font-medium text-slate-100">{activeGroup.name}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-amber-300 text-sm">Chưa chọn nhóm</p>
            <Link
              href="/admin/groups"
              className="inline-block text-sm text-blue-400 hover:underline"
            >
              Chọn nhóm tại Quản lý nhóm →
            </Link>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Tên vật thể
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Bình nước xanh"
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Mô tả chi tiết
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Mô tả chi tiết vật thể..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {(["front", "side", "back"] as Angle[]).map((angle) => (
            <ImageUploadField
              key={angle}
              label={ANGLE_LABELS[angle]}
              angle={angle}
              previewUrl={previews[angle] ?? null}
              onFileSelect={(file) => handleFileSelect(angle, file)}
            />
          ))}
        </div>

        <ImagePreviewGrid items={previewItems} />

        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-900/30 text-green-400 border border-green-800"
                : "bg-red-900/30 text-red-400 border border-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !activeGroup}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {loading ? "Đang lưu..." : "Đăng ký vật thể"}
        </button>
      </form>
    </div>
  );
}
