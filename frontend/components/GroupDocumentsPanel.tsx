"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
        text: err instanceof Error ? err.message : "Không tải được tài liệu khu di tích",
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
    try {
      let successCount = 0;
      const failedUploads: string[] = [];

      if (hasText && !hasFiles) {
        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("text", text.trim());
        await createGroupDocument(groupId, formData, setUploadPhase);
        successCount = 1;
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
          try {
            await createGroupDocument(groupId, formData, setUploadPhase);
            successCount += 1;
          } catch (err) {
            const reason =
              err instanceof Error ? err.message : "Thêm tài liệu thất bại";
            failedUploads.push(`${file.name}: ${reason}`);
          }
        }

        if (failedUploads.length > 0) {
          await loadDocuments();
          setUploadPhase(null);
          if (successCount > 0) {
            setTitle("");
            setText("");
            setFiles([]);
          }
          setMessage({
            type: "error",
            text:
              successCount > 0
                ? `Đã thêm ${successCount}/${files.length} tài liệu. Lỗi: ${failedUploads.join("; ")}`
                : `Thêm tài liệu thất bại: ${failedUploads.join("; ")}`,
          });
          return;
        }
      }

      setTitle("");
      setText("");
      setFiles([]);
      setUploadPhase("complete");
      setMessage({
        type: "success",
        text:
          files.length > 1
            ? `Đã thêm ${files.length} tài liệu vào khu di tích.`
            : "Đã thêm tài liệu vào khu di tích.",
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
    if (!confirm("Xóa tài liệu này khỏi khu di tích?")) return;
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

  if (!groupId) {
    return (
      <section className="admin-card-padded">
        <h2 className="admin-card-title mb-2">Tài liệu tri thức khu di tích</h2>
        <p className="admin-muted text-sm">Chọn khu di tích để quản lý tài liệu.</p>
      </section>
    );
  }

  return (
    <section className="admin-card-padded space-y-4">
      <div>
        <h2 className="admin-card-title">Tài liệu tri thức khu di tích</h2>
        <p className="admin-subtitle mt-1">
          Tài liệu cho khu di tích <span className="text-[var(--foreground)]">{groupName}</span> — hỗ trợ .txt, .docx, .pdf và văn bản trực tiếp. Có thể thêm nhiều tài liệu vào cùng một khu di tích.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề tài liệu (tùy chọn nếu upload file)"
          className="admin-input"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={"Văn bản trực tiếp hoặc Markdown (# Tiêu đề)\n\nNội dung..."}
          className="admin-textarea"
        />
        <input
          type="file"
          multiple
          accept=".txt,.docx,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="admin-muted block w-full text-sm file:mr-3 file:rounded-lg file:border file:px-4 file:py-2"
        />
        {files.length > 0 && (
          <p className="admin-muted text-xs">
            Đã chọn {files.length} file: {files.map((f) => f.name).join(", ")}
          </p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={loading}
            className="admin-btn-primary"
          >
            Thêm tài liệu
          </button>
          {uploadPhase && (
            <span
              className={`text-sm ${
                uploadPhase === "complete"
                  ? "text-green-300"
                  : "animate-pulse"
              }`}
            >
              {uploadPhaseLabel(uploadPhase)}
            </span>
          )}
        </div>
      </form>

      {message && (
        <div
          className={`admin-alert ${
            message.type === "success" ? "admin-alert-success" : "admin-alert-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <ul className="admin-list">
        {documents.length === 0 ? (
          <li className="admin-list-item admin-muted text-sm">Chưa có tài liệu nào.</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="admin-list-item !flex-col !items-stretch space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="admin-muted mt-1 text-xs">
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
                    className="admin-link disabled:opacity-50"
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
                    className="text-sm text-red-300 hover:text-red-200"
                  >
                    Xóa
                  </button>
                </div>
              </div>
              {viewingDocId === doc.id && viewingText !== null && (
                <div className="admin-stop-card">
                  <p className="admin-muted mb-2 text-xs">
                    Bản text đã trích xuất và lưu (dùng cho chunk/RAG)
                  </p>
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed">
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
