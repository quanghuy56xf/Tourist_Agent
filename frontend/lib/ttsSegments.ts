/** Split by period so each clause ending with "." becomes its own TTS segment. */
export function splitTextForTtsSegments(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const segments: string[] = [];
  let start = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    if (normalized[index] !== ".") continue;
    const piece = normalized.slice(start, index + 1).trim();
    if (piece) segments.push(piece);
    start = index + 1;
  }

  const tail = normalized.slice(start).trim();
  if (tail) segments.push(tail);

  return segments.length > 0 ? segments : [normalized];
}
