"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { findGroupBySlug, rememberVisitorGroup } from "@/lib/groupSlug";
import { GroupSummary, listPublicGroups } from "@/lib/api";

export default function GroupRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params?.groupSlug === "string" ? params.groupSlug : "";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!slug) {
      router.replace("/");
      return;
    }

    let cancelled = false;

    listPublicGroups()
      .then((groups: GroupSummary[]) => {
        if (cancelled) return;
        const group = findGroupBySlug(groups, slug);
        if (!group) {
          router.replace("/");
          return;
        }
        rememberVisitorGroup(group);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, [router, slug]);

  if (!ready) {
    return (
      <div className="artifact-shell flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return children;
}
