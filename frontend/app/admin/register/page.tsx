"use client";

import { useCallback, useEffect, useState } from "react";
import ImagePreviewGrid from "@/components/ImagePreviewGrid";
import ImageUploadField from "@/components/ImageUploadField";
import {
  AdminAlert,
  AdminButton,
  AdminCard,
  AdminField,
  AdminInput,
  AdminLink,
  AdminPage,
  AdminPageHeader,
  AdminTextarea,
  alertClass,
} from "@/components/admin/ui";
import { ActiveGroup, getActiveGroup } from "@/lib/activeGroup";
import { listGroupDocuments, registerObject } from "@/lib/api";
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
  const [docCount, setDocCount] = useState<number | null>(null);
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

  useEffect(() => {
    if (!activeGroup) {
      setDocCount(null);
      return;
    }
    listGroupDocuments(activeGroup.id)
      .then((docs) => setDocCount(docs.length))
      .catch(() => setDocCount(null));
  }, [activeGroup]);

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
        text: "Chưa chọn khu di tích. Chọn khu từ dropdown bên phải menu.",
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
        text: `Đăng ký thành công vào "${activeGroup.name}"! ID: ${result.item_id}`,
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
    <AdminPage>
      <AdminPageHeader
        eyebrow="Hiện vật"
        title="Đăng ký hiện vật"
        description="Tải ảnh nhiều góc cho hiện vật. Chọn khu di tích từ dropdown bên phải menu."
      />

      <AdminCard title="Khu di tích đăng ký">
        {activeGroup ? (
          <div className="space-y-2">
            <p className="font-display text-lg">{activeGroup.name}</p>
            <p className="admin-muted text-sm">
              {docCount === null
                ? "Đang tải tài liệu khu di tích..."
                : `${docCount} tài liệu đã index trong RAG`}
            </p>
            <AdminLink href="/admin/groups">Quản lý tài liệu & hiện vật →</AdminLink>
          </div>
        ) : (
          <AdminAlert type="warning">
            Chưa chọn khu di tích. Chọn từ dropdown bên phải menu, hoặc{" "}
            <AdminLink href="/admin" className="underline">
              tạo khu mới
            </AdminLink>
            .
          </AdminAlert>
        )}
      </AdminCard>

      <form onSubmit={handleSubmit} className="space-y-5">
        <AdminField label="Tên hiện vật">
          <AdminInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Bình nước xanh"
          />
        </AdminField>

        <AdminField label="Mô tả chi tiết">
          <AdminTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="Mô tả chi tiết hiện vật..."
          />
        </AdminField>

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

        {message && <div className={alertClass(message.type)}>{message.text}</div>}

        <AdminButton type="submit" disabled={loading || !activeGroup} className="w-full py-3">
          {loading ? "Đang lưu..." : "Đăng ký hiện vật"}
        </AdminButton>
      </form>
    </AdminPage>
  );
}
