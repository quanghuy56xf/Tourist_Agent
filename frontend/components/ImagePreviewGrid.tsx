"use client";

interface PreviewItem {
  angle: string;
  label: string;
  url: string;
}

interface ImagePreviewGridProps {
  items: PreviewItem[];
}

export default function ImagePreviewGrid({ items }: ImagePreviewGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-300">Xem trước ảnh</h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.angle} className="space-y-1">
            <img
              src={item.url}
              alt={item.label}
              className="w-full aspect-square object-cover rounded-lg border border-slate-700"
            />
            <p className="text-xs text-center text-slate-500">{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
