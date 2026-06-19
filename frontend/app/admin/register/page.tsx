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
import { useAdminGroup } from "@/components/admin/AdminGroupProvider";
import { bulkRegisterItem, listGroupDocuments, registerObject } from "@/lib/api";
import { groupBulkFiles, parseDescriptionMap } from "@/lib/bulkRegistration";
import { compressImage } from "@/lib/imageCompress";

type Angle = "front" | "side" | "back";
type RegisterMode = "single" | "bulk";
type BulkStatus = "pending" | "running" | "success" | "skipped" | "error";

interface BulkResult {
  name: string;
  status: BulkStatus;
  message: string;
}

const ANGLE_LABELS: Record<Angle, string> = {
  front: "Ảnh mặt trước",
  side: "Ảnh mặt bên",
  back: "Ảnh mặt sau",
};

const STATUS_STYLES: Record<BulkStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  running: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  skipped: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};

export default function RegisterPage() {
  const { activeGroup } = useAdminGroup();
  const [mode, setMode] = useState<RegisterMode>("single");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<Partial<Record<Angle, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Angle, string>>>({});
  const [loading, setLoading] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [skipExisting, setSkipExisting] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);



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
    const compressedFile = new File([compressed], `${angle}.jpg`, { type: "image/jpeg" });
    setFiles((prev) => ({ ...prev, [angle]: compressedFile }));
    setPreviews((prev) => {
      if (prev[angle]) URL.revokeObjectURL(prev[angle]!);
      return { ...prev, [angle]: URL.createObjectURL(compressed) };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!activeGroup) return setMessage({ type: "error", text: "Chưa chọn khu di tích." });
    if (!name.trim() || !description.trim()) return setMessage({ type: "error", text: "Vui lòng nhập tên và mô tả" });
    if (!files.front) return setMessage({ type: "error", text: "Ảnh mặt trước là bắt buộc" });

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
      setMessage({ type: "success", text: `Đăng ký thành công vào "${activeGroup.name}"! ID: ${result.item_id}` });
      setName("");
      setDescription("");
      setFiles({});
      Object.values(previews).forEach((url) => url && URL.revokeObjectURL(url));
      setPreviews({});
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Đăng ký thất bại" });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    setMessage(null);
    if (!activeGroup) return setMessage({ type: "error", text: "Chưa chọn khu di tích." });
    if (!folderFiles.length || !jsonFile) return setMessage({ type: "error", text: "Vui lòng chọn thư mục ảnh và file JSON mô tả." });

    setLoading(true);
    try {
      const descriptions = parseDescriptionMap(await jsonFile.text());
      const items = groupBulkFiles(folderFiles, descriptions);
      if (!items.length) throw new Error("Không tìm thấy ảnh trong các thư mục hiện vật.");

      const initialResults: BulkResult[] = items.map((item) => ({
        name: item.name,
        status: item.validationError ? "error" : "pending",
        message: item.validationError ?? "Đang chờ",
      }));
      setBulkResults(initialResults);

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (item.validationError) continue;
        setBulkResults((current) => current.map((result, resultIndex) => resultIndex === index ? { ...result, status: "running", message: "Đang đăng ký..." } : result));
        try {
          const formData = new FormData();
          formData.append("name", item.name);
          formData.append("description", item.description);
          formData.append("group_id", String(activeGroup.id));
          formData.append("skip_existing", String(skipExisting));
          item.images.forEach((image) => formData.append("images", image, image.name));
          const response = await bulkRegisterItem(formData);
          setBulkResults((current) => current.map((result, resultIndex) => resultIndex === index ? {
            ...result,
            status: response.status,
            message: response.status === "skipped" ? "Đã tồn tại, đã bỏ qua" : `Thành công (ID: ${response.item_id})`,
          } : result));
        } catch (err) {
          setBulkResults((current) => current.map((result, resultIndex) => resultIndex === index ? { ...result, status: "error", message: err instanceof Error ? err.message : "Đăng ký thất bại" } : result));
        }
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Không thể đọc dữ liệu hàng loạt" });
    } finally {
      setLoading(false);
    }
  };

  const previewItems = (["front", "side", "back"] as Angle[])
    .filter((angle) => previews[angle])
    .map((angle) => ({ angle, label: ANGLE_LABELS[angle], url: previews[angle]! }));

  return (
    <AdminPage>
      <AdminPageHeader eyebrow="Hiện vật" title="Đăng ký hiện vật" description="Đăng ký từng hiện vật hoặc nạp hàng loạt từ thư mục ảnh và file JSON." />

      <AdminCard title="Khu di tích đăng ký">
        {activeGroup ? (
          <div className="space-y-2">
            <p className="font-display text-lg">{activeGroup.name}</p>
            <p className="admin-muted text-sm">{docCount === null ? "Đang tải tài liệu khu di tích..." : `${docCount} tài liệu đã index trong RAG`}</p>
            <AdminLink href="/admin/groups">Quản lý tài liệu & hiện vật →</AdminLink>
          </div>
        ) : (
          <AdminAlert type="warning">Chưa chọn khu di tích. Chọn từ dropdown bên phải menu.</AdminAlert>
        )}
      </AdminCard>

      <div className="grid grid-cols-2 rounded-xl bg-[var(--secondary)] p-1 border border-[var(--border)]">
        {(["single", "bulk"] as RegisterMode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setMessage(null);
            }}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              mode === value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)]"
            }`}
          >
            {value === "single" ? "Đăng ký đơn" : "Đăng ký hàng loạt"}
          </button>
        ))}
      </div>

      {mode === "single" ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <AdminField label="Tên hiện vật"><AdminInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Bình nước xanh" /></AdminField>
          <AdminField label="Mô tả chi tiết"><AdminTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} placeholder="Mô tả chi tiết hiện vật..." /></AdminField>
          <div className="grid gap-4 sm:grid-cols-3">{(["front", "side", "back"] as Angle[]).map((angle) => <ImageUploadField key={angle} label={ANGLE_LABELS[angle]} angle={angle} previewUrl={previews[angle] ?? null} onFileSelect={(file) => handleFileSelect(angle, file)} />)}</div>
          <ImagePreviewGrid items={previewItems} />
          {message && <div className={alertClass(message.type)}>{message.text}</div>}
          <AdminButton type="submit" disabled={loading || !activeGroup} className="w-full py-3">{loading ? "Đang lưu..." : "Đăng ký hiện vật"}</AdminButton>
        </form>
      ) : (
        <div className="space-y-5">
          <AdminCard title="Nguồn dữ liệu" description="Mỗi thư mục con là một hiện vật; tên thư mục phải khớp khóa trong file JSON.">
            <AdminField label="Thư mục ảnh">
              <input className="admin-input" type="file" multiple accept="image/*" ref={(input) => { if (input) { input.setAttribute("webkitdirectory", ""); input.setAttribute("directory", ""); } }} onChange={(e) => { setFolderFiles(Array.from(e.target.files ?? [])); setBulkResults([]); }} />
            </AdminField>
            <p className="admin-muted text-sm">{folderFiles.length ? `Đã chọn ${folderFiles.length} ảnh` : "Chưa chọn thư mục"}</p>
            <AdminField label="File JSON mô tả">
              <AdminInput type="file" accept="application/json,.json" onChange={(e) => { setJsonFile(e.target.files?.[0] ?? null); setBulkResults([]); }} />
            </AdminField>
            <div className="flex justify-end mt-1">
              <a
                href="/templates/bulk-registration-descriptions.json"
                download="bulk-registration-descriptions.json"
                className="admin-link text-sm font-semibold"
              >
                Tải file JSON mẫu
              </a>
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} /> Bỏ qua hiện vật đã có</label>
            </div>
          </AdminCard>

          {message && <div className={alertClass(message.type)}>{message.text}</div>}
          <AdminButton type="button" disabled={loading || !activeGroup} onClick={handleBulkSubmit} className="w-full py-3">{loading ? "Đang xử lý..." : "Bắt đầu đăng ký"}</AdminButton>

          {bulkResults.length > 0 && (
            <AdminCard title={`Kết quả (${bulkResults.length} hiện vật)`}>
              <div className="space-y-2">{bulkResults.map((result) => (
                <div key={result.name} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-3">
                  <div><p className="font-semibold">{result.name}</p><p className="mt-1 text-sm text-slate-500">{result.message}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[result.status]}`}>{result.status}</span>
                </div>
              ))}</div>
            </AdminCard>
          )}
        </div>
      )}
    </AdminPage>
  );
}
