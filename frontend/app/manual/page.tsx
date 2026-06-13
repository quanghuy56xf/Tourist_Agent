"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import { fetchApi, resolveImageUrl } from "@/lib/api";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type Item = {
  id: number;
  name: string;
  description: string;
  main_image_url: string | null;
};

export default function ManualSelectionPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi("/api/objects/all")
      .then((res) => {
        setAllItems(res.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="artifact-shell min-h-screen">
      <header className="px-6 pb-4 pt-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <BackButton onClick={() => router.push("/method")} label={t.common.back} className="mb-4" />
        <p className="artifact-section-label mb-1">{t.manual.catalog}</p>
        <h1 className="font-display text-xl">{t.manual.title}</h1>
      </header>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {allItems.map((item) => {
              const imageUrl = resolveImageUrl(item.main_image_url);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/item/${item.id}`)}
                  className="artifact-card overflow-hidden p-2 text-left transition-transform active:scale-[0.98]"
                >
                  <div
                    className="mb-2 aspect-square overflow-hidden rounded-xl"
                    style={{ background: "var(--secondary)" }}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full items-center justify-center text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {t.common.noImage}
                      </div>
                    )}
                  </div>
                  <h4 className="line-clamp-2 text-xs font-bold leading-snug">{item.name}</h4>
                </button>
              );
            })}
            {allItems.length === 0 && (
              <p className="col-span-2 py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                {t.manual.empty}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
