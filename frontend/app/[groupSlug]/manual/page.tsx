"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/visitor/BackButton";
import HomeButton from "@/components/visitor/HomeButton";
import { getGroupItems, GroupItem, resolveImageUrl } from "@/lib/api";
import { groupPath, VISITOR_GROUP_ID_KEY } from "@/lib/groupSlug";
import { useGroupPath, useGroupSlug } from "@/lib/useGroupPath";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

export default function ManualSelectionPage() {
  const router = useRouter();
  const groupSlug = useGroupSlug();
  const methodPath = useGroupPath("/method");
  const { t } = useVisitorLocale();
  const [allItems, setAllItems] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const groupId = Number(localStorage.getItem(VISITOR_GROUP_ID_KEY));
    if (!groupId) {
      setLoading(false);
      return;
    }
    getGroupItems(groupId)
      .then((res) => {
        setAllItems(res.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="artifact-shell min-h-screen">
      <header className="px-6 pb-4 pt-8" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="mb-4 flex items-center gap-2">
          <HomeButton />
          <BackButton onClick={() => router.push(methodPath)} label={t.common.back} />
        </div>
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
                  onClick={() => router.push(groupPath(groupSlug, `/item/${item.id}`))}
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
