export function buildItemAudioPath(
  itemId: number,
  persona: string,
  language: string
): string {
  const params = new URLSearchParams({ persona, language });
  return `/api/objects/${itemId}/content/audio?${params}`;
}
