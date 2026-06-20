"use client";

import { useRef, useState } from "react";
import {
  downloadMinimapTemplate,
  uploadMinimapConfig,
} from "@/lib/api";
import type { MinimapTemplateConfig } from "@/lib/api";
import { AdminAlert, AdminButton, AdminCard } from "./ui";

interface MinimapConfigPanelProps {
  groupId: number;
  groupName: string;
}

export default function MinimapConfigPanel({
  groupId,
  groupName,
}: MinimapConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const payload = await downloadMinimapTemplate(groupId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `minimap-${groupId}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Không tải được JSON mẫu",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const payload = JSON.parse(String(reader.result)) as MinimapTemplateConfig;
        await uploadMinimapConfig(groupId, payload);
        setMessage({ type: "success", text: "Đã cập nhật cấu hình Minimap." });
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error instanceof Error
              ? error.message
              : "File JSON không hợp lệ hoặc không thể upload",
        });
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      setMessage({ type: "error", text: "Không thể đọc file JSON." });
    };
    reader.readAsText(file);
  };

  return (
    <AdminCard
      title="Cấu hình Minimap"
      description={`Tải JSON của ${groupName}, chỉnh tọa độ và tên hiện vật, sau đó upload lại. Hệ thống sẽ tự ánh xạ tên sang ID của môi trường hiện tại.`}
    >
      {message && <AdminAlert type={message.type}>{message.text}</AdminAlert>}
      <div className="flex flex-wrap items-center gap-4">
        <label className="admin-btn-primary cursor-pointer">
          {loading ? "Đang xử lý..." : "Upload cấu hình JSON"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            disabled={loading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        <button
          type="button"
          className="text-sm text-amber-200/70 underline transition-colors hover:text-amber-100 disabled:opacity-50"
          disabled={loading}
          onClick={() => void handleDownload()}
        >
          Template JSON
        </button>
      </div>
    </AdminCard>
  );
}
