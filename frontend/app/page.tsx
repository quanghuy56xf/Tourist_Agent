"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LanguageSelector from "@/components/LanguageSelector";
import { GroupSummary, listDiscoverableGroups } from "@/lib/api";
import { rememberVisitorGroup } from "@/lib/groupSlug";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

const GROUP_LOAD_RETRY_MS = 1500;

export default function GroupSelectionPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    async function loadGroups() {
      try {
        const data = await listDiscoverableGroups();
        if (cancelled) return;
        setGroups(data);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setLoading(true);
        retryTimer = window.setTimeout(loadGroups, GROUP_LOAD_RETRY_MS);
      }
    }

    void loadGroups();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  const handleSelect = (group: GroupSummary) => {
    const slug = rememberVisitorGroup(group);
    router.push(`/${slug}`);
  };

  return (
    <div className="artifact-shell artifact-shell-pad">
      <div className="mb-6 flex justify-end">
        <LanguageSelector />
      </div>

      <header className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)" }}
          >
            <span style={{ color: "var(--primary-foreground)" }}>✦</span>
          </div>
          <span className="text-2xl font-bold uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>{t.productName}</span>
        </div>
        <Image
          src="/hera-app-icon.png"
          alt="HERA"
          width={192}
          height={192}
          priority
          className="mx-auto mb-4 h-48 w-48 rounded-2xl object-cover"
        />
        <h1 className="font-display text-3xl" style={{ color: "var(--foreground)" }}>
          {t.groups.headline}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {t.groups.subtitle}
        </p>
      </header>

      <section className="mb-8 space-y-3">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
            />
          </div>
        ) : groups.length === 0 ? (
          <p className="py-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            {t.groups.empty}
          </p>
        ) : (
          groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleSelect(group)}
              className="artifact-card flex w-full items-center justify-between gap-4 p-5 text-left transition-transform active:scale-[0.98]"
            >
              <div>
                <h2 className="text-base font-bold">{group.name}</h2>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {group.item_count} {t.groups.itemCount}
                </p>
              </div>
              <span style={{ color: "var(--primary)" }}>→</span>
            </button>
          ))
        )}
      </section>

      <div className="mt-auto text-center">
        <button
          type="button"
          onClick={() => router.push("/admin/login")}
          className="text-xs underline-offset-4 hover:underline"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t.home.management}
        </button>
      </div>
    </div>
  );
}
