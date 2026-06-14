export function parseSimilarity(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;

  const similarity = Number(value);
  if (!Number.isFinite(similarity) || similarity < 0 || similarity > 1) {
    return null;
  }

  return similarity;
}

export function formatSimilarityPercent(
  similarity: number | null
): string | null {
  return similarity === null ? null : `${(similarity * 100).toFixed(1)}%`;
}
