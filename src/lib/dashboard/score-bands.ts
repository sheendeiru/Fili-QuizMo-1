export const SCORE_BANDS = [
  {
    key: "excellent",
    label: "Excellent (90–100)",
    color: "var(--color-success)",
    minimum: 90,
  },
  {
    key: "good",
    label: "Good (75–89)",
    color: "var(--color-primary-foreground)",
    minimum: 75,
  },
  {
    key: "needs-improvement",
    label: "Needs Improvement (50–74)",
    color: "var(--color-warning)",
    minimum: 50,
  },
  {
    key: "at-risk",
    label: "At Risk (below 50)",
    color: "var(--color-danger)",
    minimum: 0,
  },
] as const;

export type ScoreBandKey = (typeof SCORE_BANDS)[number]["key"];

export type ScoreDistributionBand = {
  key: ScoreBandKey;
  label: string;
  color: string;
  count: number;
  value: number;
};

export type ScoreDistribution = {
  quiz: string;
  average: number;
  sampleSize: number;
  bands: ScoreDistributionBand[];
};

export function scoreBandFor(score: number): ScoreBandKey {
  return (
    SCORE_BANDS.find((band) => score >= band.minimum)?.key ?? "at-risk"
  );
}

export function scoreStatusLabel(score: number): string {
  switch (scoreBandFor(score)) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs-improvement":
      return "Needs Improvement";
    default:
      return "At Risk";
  }
}

/**
 * Rounds band percentages with the largest-remainder method so the chart
 * segments always add up to 100 without distorting the sample.
 */
function toPercentageValues(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return counts.map(() => 0);
  }

  const raw = counts.map((count) => (count / total) * 100);
  const values = raw.map((value) => Math.floor(value));
  const remainder = 100 - values.reduce((sum, value) => sum + value, 0);
  const ranked = raw
    .map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }))
    .sort((left, right) => right.fraction - left.fraction);

  for (let index = 0; index < remainder; index += 1) {
    values[ranked[index % ranked.length].index] += 1;
  }

  return values;
}

export function buildScoreDistribution(
  quiz: string,
  scores: readonly number[],
): ScoreDistribution | null {
  const validScores = scores.filter(
    (score) => Number.isFinite(score) && score >= 0,
  );

  if (validScores.length === 0) {
    return null;
  }

  const counts = SCORE_BANDS.map(
    (band) =>
      validScores.filter((score) => scoreBandFor(score) === band.key).length,
  );
  const values = toPercentageValues(counts);
  const average =
    Math.round(
      (validScores.reduce((sum, score) => sum + score, 0) /
        validScores.length) *
        10,
    ) / 10;

  return {
    quiz,
    average,
    sampleSize: validScores.length,
    bands: SCORE_BANDS.map((band, index) => ({
      key: band.key,
      label: band.label,
      color: band.color,
      count: counts[index],
      value: values[index],
    })),
  };
}
