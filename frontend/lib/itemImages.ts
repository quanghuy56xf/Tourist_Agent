import { GroupItem, resolveImageUrl } from "@/lib/api";

export function getItemImageUrls(item: GroupItem): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined) => {
    if (!raw) return;
    const resolved = resolveImageUrl(raw);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    urls.push(resolved);
  };

  add(item.main_image_url);
  for (const image of item.images ?? []) {
    add(image.url);
  }

  return urls;
}
