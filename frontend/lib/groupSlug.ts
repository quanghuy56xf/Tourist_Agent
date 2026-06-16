export function slugifyGroupName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function findGroupBySlug<T extends { id: number; name: string }>(
  groups: T[],
  slug: string
): T | undefined {
  return groups.find((group) => slugifyGroupName(group.name) === slug);
}

export function groupPath(slug: string, suffix = ""): string {
  if (!suffix || suffix === "/") return `/${slug}`;
  return `/${slug}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

export const VISITOR_GROUP_ID_KEY = "visitor_group_id";
export const VISITOR_GROUP_SLUG_KEY = "visitor_group_slug";
export const VISITOR_GROUP_NAME_KEY = "visitor_group_name";

export function rememberVisitorGroup(group: { id: number; name: string }): string {
  const slug = slugifyGroupName(group.name);
  if (typeof window !== "undefined") {
    localStorage.setItem(VISITOR_GROUP_ID_KEY, String(group.id));
    localStorage.setItem(VISITOR_GROUP_SLUG_KEY, slug);
    localStorage.setItem(VISITOR_GROUP_NAME_KEY, group.name);
  }
  return slug;
}

export function readStoredGroupSlug(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VISITOR_GROUP_SLUG_KEY);
}
