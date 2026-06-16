"use client";

import { useParams } from "next/navigation";

import { groupPath } from "@/lib/groupSlug";

export function useGroupSlug(): string {
  const params = useParams();
  const slug = params?.groupSlug;
  if (typeof slug !== "string" || !slug) {
    throw new Error("Missing group slug in route");
  }
  return slug;
}

export function useGroupPath(suffix = ""): string {
  return groupPath(useGroupSlug(), suffix);
}