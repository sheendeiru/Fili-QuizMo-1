import { describe, expect, it } from "vitest";
import {
  buildScoreDistribution,
  scoreBandFor,
  scoreStatusLabel,
} from "./score-bands";

describe("score distributions", () => {
  it("classifies scores into the four bands", () => {
    expect(scoreBandFor(95)).toBe("excellent");
    expect(scoreBandFor(90)).toBe("excellent");
    expect(scoreBandFor(89)).toBe("good");
    expect(scoreBandFor(75)).toBe("good");
    expect(scoreBandFor(74)).toBe("needs-improvement");
    expect(scoreBandFor(50)).toBe("needs-improvement");
    expect(scoreBandFor(49)).toBe("at-risk");
    expect(scoreStatusLabel(49)).toBe("At Risk");
  });

  it("rounds band percentages so they add up to 100", () => {
    const distribution = buildScoreDistribution("Quiz", [95, 80, 60, 20]);

    expect(distribution).not.toBeNull();
    expect(distribution?.average).toBe(63.8);
    expect(distribution?.sampleSize).toBe(4);
    expect(distribution?.bands.map((band) => band.value)).toEqual([
      25, 25, 25, 25,
    ]);
    expect(
      distribution?.bands.reduce((sum, band) => sum + band.value, 0),
    ).toBe(100);
  });

  it("keeps a lopsided sample at exactly 100 percent", () => {
    const distribution = buildScoreDistribution("Quiz", [95, 20, 10]);

    expect(
      distribution?.bands.reduce((sum, band) => sum + band.value, 0),
    ).toBe(100);
    expect(distribution?.bands.map((band) => band.count)).toEqual([
      1, 0, 0, 2,
    ]);
  });

  it("returns null when there are no completed scores", () => {
    expect(buildScoreDistribution("Quiz", [])).toBeNull();
  });
});
