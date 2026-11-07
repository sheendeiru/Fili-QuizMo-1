/**
 * Raw score label such as "8/10".
 * Returns null when either count is missing or invalid, so callers can fall
 * back to the percentage instead of showing something wrong.
 */
export function formatRawScore(
  correct: number | string | null | undefined,
  total: number | string | null | undefined,
): string | null {
  if (correct === null || correct === undefined) return null;
  if (total === null || total === undefined) return null;

  const right = Number(correct);
  const outOf = Number(total);

  if (!Number.isFinite(right) || !Number.isFinite(outOf) || outOf <= 0) {
    return null;
  }

  return `${right}/${outOf}`;
}
