"use client";

import { useCallback, useEffect, useState } from "react";
import {
  bulkRegenerateGroupContent,
  createGroupDocument,
  deleteGroupDocument,
  getGroupDocument,
  GroupDocumentSummary,
  GroupDocumentUploadPhase,
  listGroupDocuments,
} from "@/lib/api";

interface GroupDocumentsPanelProps {
  groupId: number | null;
  groupName: string | null;
}

function uploadPhaseLabel(phase: GroupDocumentUploadPhase): string {
  switch (phase) {
    case "uploading":
      return "Đang upload...";
    case "encoding":
      return "Đang mã hóa dữ liệu";
    case "complete":
      return "Hoàn thành";
  }
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base || filename;
}

export default function GroupDocumentsPanel({
  groupId,
  groupName,
}: GroupDocumentsPanelProps) {
  const [documents, setDocuments] = useState<GroupDocumentSummary[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<GroupDocumentUploadPhase | null>(
    null
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [viewingDocId, setViewingDocId] = useState<number | null>(null);
  const [viewingText, setViewingText] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [lastUploadedDocumentIds, setLastUploadedDocumentIds] = useState<number[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!groupId) {
      setDocuments([]);
      return;
    }
    try {
      const data = await listGroupDocuments(groupId);
      setDocuments(data);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được tài liệu nhóm",
      });
    }
  }, [groupId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;

    const hasText = text.trim().length > 0;
    const hasFiles = files.length > 0;

    if (!hasText && !hasFiles) {
      setMessage({
        type: "error",
        text: "Nhập văn bản hoặc chọn file .txt / .docx / .pdf",
      });
      return;
    }

    if (hasText && !hasFiles && !title.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập tiêu đề tài liệu" });
      return;
    }

    setLoading(true);
    setUploadPhase("uploading");
    setMessage(null);
    const uploadedDocumentIds: number[] = [];

    try {
      if (hasText && !hasFiles) {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("text", text.trim());
        const created = await createGroupDocument(groupId, formData, setUploadPhase);
        uploadedDocumentIds.push(created.id);
      } else {
        for (const file of files) {
          const formData = new FormData();
          const docTitle =
            files.length === 1 && title.trim()
              ? title.trim()
              : title.trim()
                ? `${title.trim()} — ${titleFromFilename(file.name)}`
                : titleFromFilename(file.name);
          formData.append("title", docTitle);
          formData.append("file", file);
          const created = await createGroupDocument(groupId, formData, setUploadPhase);
          uploadedDocumentIds.push(created.id);
        }
      }

      setLastUploadedDocumentIds(uploadedDocumentIds);

      setTitle("");
      setText("");
      setFiles([]);
      setUploadPhase("complete");
      setMessage({
        type: "success",
        text:
          files.length > 1
            ? `Đã thêm ${files.length} tài liệu vào nhóm. Mô tả vật thể liên quan đang được cập nhật tự động.`
            : "Đã thêm tài liệu vào nhóm. Mô tả vật thể liên quan đang được cập nhật tự động.",
      });
      await loadDocuments();
      setTimeout(() => setUploadPhase(null), 2500);
    } catch (err) {
      setUploadPhase(null);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lưu tài liệu thất bại",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!groupId) return;
    if (!confirm("Xóa tài liệu này khỏi nhóm?")) return;
    try {
      await deleteGroupDocument(groupId, documentId);
      if (viewingDocId === documentId) {
        setViewingDocId(null);
        setViewingText(null);
      }
      setMessage({ type: "success", text: "Đã xóa tài liệu" });
      await loadDocuments();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Xóa tài liệu thất bại",
      });
    }
  };

  const handleViewText = async (documentId: number) => {
    if (!groupId) return;
    if (viewingDocId === documentId) {
      setViewingDocId(null);
      setViewingText(null);
      return;
    }
    setViewLoading(true);
    setViewingDocId(documentId);
    setViewingText(null);
    try {
      const detail = await getGroupDocument(groupId, documentId);
      setViewingText(detail.extracted_text || "(Không có nội dung text)");
    } catch (err) {
      setViewingDocId(null);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được nội dung tài liệu",
      });
    } finally {
      setViewLoading(false);
    }
  };

  const handleBulkUpdateDescriptions = async () => {
    if (!groupId) return;
    setBulkUpdating(true);
    setMessage(null);
    try {
      const result = await bulkRegenerateGroupContent(
        groupId,
        lastUploadedDocumentIds.length > 0 ? lastUploadedDocumentIds : undefined
      );
      setMessage({
        type: "success",
        text: `Đã cập nhật ${result.updated_count} vật thể, bỏ qua ${result.skipped_count} vật thể không liên quan.`,
      });
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Cập nhật mô tả hàng loạt thất bại",
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  if (!groupId) {
    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold mb-2">Tài liệu tri thức nhóm</h2>
        <p className="text-sm text-slate-400">Chọn nhóm để quản lý tài liệu.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tài liệu tri thức nhóm</h2>
        <p className="text-sm text-slate-400 mt-1">
          Tài liệu cho nhóm <span className="text-slate-200">{groupName}</span> — hỗ trợ .txt, .docx, .pdf và văn bản trực tiếp. Có thể thêm nhiều tài liệu vào cùng một nhóm.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề tài liệu (tùy chọn nếu upload file)"
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={"Văn bản trực tiếp hoặc Markdown (# Tiêu đề)\n\nNội dung..."}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
        />
        <input
          type="file"
          multiple
          accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-100"
        />
        {files.length > 0 && (
          <p className="text-xs text-slate-400">
            Đã chọn {files.length} file: {files.map((f) => f.name).join(", ")}
          </p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
          >
            Thêm tài liệu
          </button>
          {uploadPhase && (
            <span
              className={`text-sm ${
                uploadPhase === "complete"
                  ? "text-green-400"
                  : "text-slate-300 animate-pulse"
              }`}
            >
              {uploadPhaseLabel(uploadPhase)}
            </span>
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={bulkUpdating || documents.length === 0}
          onClick={handleBulkUpdateDescriptions}
          className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
        >
          {bulkUpdating ? "Đang cập nhật thông tin..." : "Cập nhật thông tin"}
        </button>
        {lastUploadedDocumentIds.length > 0 && (
          <span className="text-xs text-slate-400">
            Ưu tiên {lastUploadedDocumentIds.length} tài liệu vừa thêm
          </span>
        )}
      </div>

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

      <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
        {documents.length === 0 ? (
          <li className="p-4 text-sm text-slate-500">Chưa có tài liệu nào.</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100">{doc.title}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {doc.source_type.toUpperCase()}
                    {doc.original_filename ? ` · ${doc.original_filename}` : ""}
                    {" · "}
                    {doc.chunk_count} chunk · {doc.status}
                    {doc.error_message ? ` · ${doc.error_message}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleViewText(doc.id)}
                    disabled={viewLoading && viewingDocId === doc.id}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
                  >
                    {viewLoading && viewingDocId === doc.id
                      ? "Đang tải..."
                      : viewingDocId === doc.id
                        ? "Ẩn text"
                        : "Xem text"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Xóa
                  </button>
                </div>
              </div>
              {viewingDocId === doc.id && viewingText !== null && (
                <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500 mb-2">
                    Bản text đã trích xuất và lưu (dùng cho chunk/RAG)
                  </p>
                  <pre className="max-h-80 overflow-y-auto text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {viewingText}
                  </pre>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
