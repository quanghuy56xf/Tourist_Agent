"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminButton, AdminSelect } from "@/components/admin/ui";

const DEFAULT_PAGE_SIZES = [10, 20, 50];

export function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

export function TruncatedText({
  text,
  maxLen = 32,
  className = "",
  mono = false,
}: {
  text: string | null | undefined;
  maxLen?: number;
  className?: string;
  mono?: boolean;
}) {
  const full = (text ?? "").trim() || "—";
  const short = full === "—" ? full : truncateText(full, maxLen);
  const needsTitle = full !== "—" && full.length > maxLen;

  return (
    <span
      className={`block max-w-full truncate ${mono ? "font-mono text-xs" : ""} ${className}`.trim()}
      title={needsTitle ? full : undefined}
    >
      {short}
    </span>
  );
}

export function formatShortDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function useTablePagination<T>(items: T[], defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const slice = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    slice,
    total,
  };
}

export function AdminTableShell({
  children,
  minWidth = "720px",
  maxHeight = "min(420px, 55vh)",
}: {
  children: ReactNode;
  minWidth?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className="overflow-auto rounded-md border border-white/10"
      style={{ maxHeight }}
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function AdminTablePagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  totalPages,
  pageSizes = DEFAULT_PAGE_SIZES,
}: {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total: number;
  totalPages: number;
  pageSizes?: number[];
}) {
  if (total === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="admin-muted text-xs">
        Hiển thị {start}–{end} / {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="admin-muted flex items-center gap-2 text-xs">
          Số dòng
          <AdminSelect
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="!min-h-0 !py-1 text-xs"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </AdminSelect>
        </label>
        <AdminButton
          type="button"
          variant="ghost"
          className="!px-2 !py-1 text-xs"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Trước
        </AdminButton>
        <span className="min-w-[4.5rem] text-center text-xs">
          {page} / {totalPages}
        </span>
        <AdminButton
          type="button"
          variant="ghost"
          className="!px-2 !py-1 text-xs"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </AdminButton>
      </div>
    </div>
  );
}

export function AdminDataTable<T>({
  rows,
  emptyMessage,
  minWidth,
  maxHeight,
  defaultPageSize = 10,
  children,
}: {
  rows: T[];
  emptyMessage: string;
  minWidth?: string;
  maxHeight?: string;
  defaultPageSize?: number;
  children: (pageRows: T[]) => ReactNode;
}) {
  const pagination = useTablePagination(rows, defaultPageSize);

  if (rows.length === 0) {
    return <p className="admin-muted text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      <AdminTableShell minWidth={minWidth} maxHeight={maxHeight}>
        {children(pagination.slice)}
      </AdminTableShell>
      <AdminTablePagination
        page={pagination.page}
        setPage={pagination.setPage}
        pageSize={pagination.pageSize}
        setPageSize={pagination.setPageSize}
        total={pagination.total}
        totalPages={pagination.totalPages}
      />
    </div>
  );
}
