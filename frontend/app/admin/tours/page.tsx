"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminButton,
  AdminCard,
  AdminPage,
  AdminPageHeader,
  alertClass,
} from "@/components/admin/ui";
import {
  createTour,
  deleteTour,
  getTour,
  GroupItem,
  listAllItems,
  listTours,
  resolveImageUrl,
  TourDetail,
  TourStopPayload,
  TourSummary,
  TourWritePayload,
  updateTour,
} from "@/lib/api";

type StopDraft = TourStopPayload & {
  itemName: string;
  imageUrl: string | null;
};

type FormState = {
  title_vi: string;
  title_en: string;
  description_vi: string;
  description_en: string;
  is_published: boolean;
  stops: StopDraft[];
};

const emptyForm = (): FormState => ({
  title_vi: "",
  title_en: "",
  description_vi: "",
  description_en: "",
  is_published: true,
  stops: [],
});

function detailToForm(detail: TourDetail): FormState {
  return {
    title_vi: detail.title_vi,
    title_en: detail.title_en,
    description_vi: detail.description_vi,
    description_en: detail.description_en,
    is_published: detail.is_published,
    stops: detail.stops.map((stop) => ({
      item_id: stop.item_id,
      hint_vi: stop.hint_vi,
      hint_en: stop.hint_en,
      itemName: stop.name,
      imageUrl: stop.image_url,
    })),
  };
}

function toPayload(form: FormState): TourWritePayload {
  return {
    title_vi: form.title_vi.trim(),
    title_en: form.title_en.trim(),
    description_vi: form.description_vi.trim(),
    description_en: form.description_en.trim(),
    is_published: form.is_published,
    stops: form.stops.map((stop) => ({
      item_id: stop.item_id,
      hint_vi: stop.hint_vi?.trim() ?? "",
      hint_en: stop.hint_en?.trim() ?? "",
    })),
  };
}

export default function AdminToursPage() {
  const [tours, setTours] = useState<TourSummary[]>([]);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [pickerItemId, setPickerItemId] = useState<number | "">("");

  const usedItemIds = useMemo(
    () => new Set(form.stops.map((stop) => stop.item_id)),
    [form.stops]
  );

  const availableItems = useMemo(
    () => items.filter((item) => !usedItemIds.has(item.id)),
    [items, usedItemIds]
  );

  const loadItems = useCallback(async () => {
    try {
      const itemRows = await listAllItems();
      setItems(itemRows);
      return true;
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Không tải được danh sách hiện vật. Kiểm tra backend đang chạy.",
      });
      return false;
    }
  }, []);

  const loadTours = useCallback(async () => {
    try {
      const tourRows = await listTours(false);
      setTours(tourRows);
      return true;
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Không tải được danh sách tour. Thử khởi động lại backend.",
      });
      return false;
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    await Promise.all([loadTours(), loadItems()]);
    setLoading(false);
  }, [loadTours, loadItems]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
    setPickerItemId("");
  };

  const startCreate = async () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
    setMessage(null);
    setPickerItemId("");
    if (items.length === 0) await loadItems();
  };

  const startEdit = async (tourId: number) => {
    setMessage(null);
    setSaving(true);
    try {
      const detail = await getTour(tourId, false);
      setForm(detailToForm(detail));
      setEditingId(tourId);
      setShowForm(true);
      setPickerItemId("");
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Không tải được tour",
      });
    } finally {
      setSaving(false);
    }
  };

  const addStop = () => {
    if (pickerItemId === "") return;
    const item = items.find((row) => row.id === pickerItemId);
    if (!item || usedItemIds.has(item.id)) return;

    setForm((prev) => ({
      ...prev,
      stops: [
        ...prev.stops,
        {
          item_id: item.id,
          hint_vi: "",
          hint_en: "",
          itemName: item.name,
          imageUrl: item.main_image_url,
        },
      ],
    }));
    setPickerItemId("");
  };

  const removeStop = (index: number) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.filter((_, i) => i !== index),
    }));
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev.stops];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, stops: next };
    });
  };

  const updateStopHint = (index: number, field: "hint_vi" | "hint_en", value: string) => {
    setForm((prev) => ({
      ...prev,
      stops: prev.stops.map((stop, i) =>
        i === index ? { ...stop, [field]: value } : stop
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title_vi.trim() || !form.title_en.trim()) {
      setMessage({ type: "error", text: "Vui lòng nhập tên tour (VI và EN)" });
      return;
    }
    if (form.stops.length < 2) {
      setMessage({ type: "error", text: "Tour cần ít nhất 2 điểm dừng" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateTour(editingId, payload);
        setMessage({ type: "success", text: "Đã cập nhật tour khám phá" });
      } else {
        await createTour(payload);
        setMessage({ type: "success", text: "Đã tạo tour khám phá mới" });
      }
      resetForm();
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Lưu tour thất bại",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tourId: number) => {
    if (!window.confirm("Xóa tour này? Hành động không thể hoàn tác.")) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteTour(tourId);
      if (editingId === tourId) resetForm();
      setMessage({ type: "success", text: "Đã xóa tour" });
      await loadData();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Xóa tour thất bại",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Tour khám phá"
        title="Đăng ký tour khám phá"
        description="Tạo lộ trình tham quan bằng cách chọn hiện vật theo thứ tự và thêm gợi ý cho từng điểm"
        action={
          !showForm ? (
            <AdminButton type="button" onClick={startCreate} className="shrink-0">
              Tạo tour mới
            </AdminButton>
          ) : undefined
        }
      />

      {message && <div className={alertClass(message.type)}>{message.text}</div>}

      {showForm && (
        <AdminCard
          title={editingId ? `Sửa tour #${editingId}` : "Tạo tour khám phá mới"}
          className="space-y-5"
        >
          <div className="flex justify-end">
            <AdminButton type="button" variant="ghost" onClick={resetForm}>
              Hủy
            </AdminButton>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="block space-y-1">
                <span className="admin-label">Tên tour (Tiếng Việt)</span>
                <input
                  type="text"
                  value={form.title_vi}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_vi: e.target.value }))}
                  className="admin-input"
                  placeholder="Ví dụ: Tour khám phá Văn Miếu"
                />
              </label>
              <label className="block space-y-1">
                <span className="admin-label">Tên tour (English)</span>
                <input
                  type="text"
                  value={form.title_en}
                  onChange={(e) => setForm((prev) => ({ ...prev, title_en: e.target.value }))}
                  className="admin-input"
                  placeholder="Example: Temple of Literature tour"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="admin-label">Mô tả (Tiếng Việt)</span>
                <textarea
                  value={form.description_vi}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description_vi: e.target.value }))
                  }
                  rows={2}
                  className="admin-input"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="admin-label">Mô tả (English)</span>
                <textarea
                  value={form.description_en}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description_en: e.target.value }))
                  }
                  rows={2}
                  className="admin-input"
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, is_published: e.target.checked }))
                }
                className="rounded border"
                style={{ borderColor: "var(--border)" }}
              />
              Hiển thị tour cho khách tham quan
            </label>

            <div className="space-y-3">
              <h3 className="font-medium">Điểm dừng ({form.stops.length})</h3>
              <p className="admin-muted text-sm">
                Chọn hiện vật theo thứ tự tham quan. Gợi ý sẽ hiển thị cho khách tại từng điểm.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={pickerItemId}
                  onChange={(e) =>
                    setPickerItemId(e.target.value ? Number(e.target.value) : "")
                  }
                  disabled={availableItems.length === 0}
                  className="admin-select flex-1 disabled:opacity-60"
                >
                  <option value="">
                    {items.length === 0
                      ? "Đang tải hoặc chưa có hiện vật..."
                      : availableItems.length === 0
                        ? "Đã thêm hết hiện vật vào tour"
                        : "Chọn hiện vật để thêm..."}
                  </option>
                  {availableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} — {item.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addStop}
                  disabled={pickerItemId === ""}
                  className="admin-btn-secondary shrink-0"
                >
                  Thêm điểm dừng
                </button>
              </div>

              {items.length === 0 && (
                <p className="text-sm text-amber-300">
                  Chưa có hiện vật trong hệ thống. Hãy{" "}
                  <a href="/admin/register" className="underline hover:text-amber-200">
                    đăng ký hiện vật
                  </a>{" "}
                  trước khi tạo tour.
                </p>
              )}

              {form.stops.length === 0 ? (
                <p className="admin-muted text-sm italic">Chưa có điểm dừng nào.</p>
              ) : (
                <div className="space-y-3">
                  {form.stops.map((stop, index) => (
                    <div
                      key={`${stop.item_id}-${index}`}
                      className="admin-stop-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg" style={{ background: "var(--secondary)" }}>
                          {stop.imageUrl ? (
                            <img
                              src={resolveImageUrl(stop.imageUrl) ?? ""}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="admin-muted flex h-full w-full items-center justify-center text-xs">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="admin-muted text-xs">Điểm {index + 1}</p>
                          <p className="font-medium truncate">{stop.itemName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveStop(index, -1)}
                            disabled={index === 0}
                            className="admin-btn-secondary px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveStop(index, 1)}
                            disabled={index === form.stops.length - 1}
                            className="admin-btn-secondary px-2 py-1 text-xs disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeStop(index)}
                            className="admin-btn-danger px-2 py-1 text-xs"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-3">
                        <label className="block space-y-1">
                          <span className="admin-muted text-xs">Gợi ý (Tiếng Việt)</span>
                          <textarea
                            value={stop.hint_vi ?? ""}
                            onChange={(e) => updateStopHint(index, "hint_vi", e.target.value)}
                            rows={2}
                            placeholder="Ví dụ: Hãy quan sát hoa văn trên chuông..."
                            className="admin-textarea px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="admin-muted text-xs">Gợi ý (English)</span>
                          <textarea
                            value={stop.hint_en ?? ""}
                            onChange={(e) => updateStopHint(index, "hint_en", e.target.value)}
                            rows={2}
                            placeholder="Example: Look at the patterns on the bell..."
                            className="admin-textarea px-3 py-2 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <AdminButton type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : editingId ? "Cập nhật tour" : "Tạo tour"}
            </AdminButton>
          </form>
        </AdminCard>
      )}

      <AdminCard title="Danh sách tour" className="!p-0 overflow-hidden">
        {loading ? (
          <p className="admin-muted p-4 text-sm">Đang tải...</p>
        ) : tours.length === 0 ? (
          <p className="admin-muted p-4 text-sm">Chưa có tour nào. Tạo tour đầu tiên ở trên.</p>
        ) : (
          <ul className="admin-list !rounded-none !border-0">
            {tours.map((tour) => (
              <li key={tour.id} className="admin-list-item !flex-col sm:!flex-row">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{tour.title_vi}</p>
                    <span className="admin-muted text-xs">#{tour.id}</span>
                    {!tour.is_published && <span className="admin-badge">Ẩn</span>}
                  </div>
                  <p className="admin-muted mt-1 text-sm">
                    {tour.title_en} · {tour.stop_count} điểm dừng
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={() => startEdit(tour.id)}
                    disabled={saving}
                  >
                    Sửa
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(tour.id)}
                    disabled={saving}
                  >
                    Xóa
                  </AdminButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminPage>
  );
}
