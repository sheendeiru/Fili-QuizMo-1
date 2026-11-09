import { describe, expect, it } from "vitest";
import { parseAchievements } from "./achievements";

const progress = { awards: [], distinctQuizzes: 8, bestImprovement: 12.25, streak: 4, bestPercentage: 100 };

describe("mobile achievement parity", () => {
  it("uses five mobile badges and their progress, without inventing awards", () => {
    const badges = parseAchievements(progress);
    expect(badges.map((badge) => badge.name)).toEqual([
      "Unang Hakbang", "Masipag na Mag-aaral", "Patuloy na Pag-unlad",
      "Tuloy-tuloy na Tagumpay", "Ganap na Tagumpay",
    ]);
    expect(badges.map((badge) => badge.progress)).toEqual([
      "1/1 distinct quiz", "5/5 distinct quizzes", "12.3/10 percentage points",
      "3/3 consecutive quizzes", "100.0% / 100%",
    ]);
    expect(badges.every((badge) => badge.unlockedAt === null)).toBe(true);
  });

  it("keeps saved unlocks even when current progress is below the threshold", () => {
    const unlockedAt = "2026-11-09T08:00:00Z";
    const badges = parseAchievements({ ...progress, streak: 0, awards: [{ badge: 4, unlockedAt }] });
    expect(badges[3].unlockedAt).toBe(unlockedAt);
    expect(badges[0].unlockedAt).toBeNull();
  });

  it.each([null, {}, { ...progress, awards: null }, { ...progress, bestPercentage: "100" },
    { ...progress, awards: [{ badge: 1, unlockedAt: "bad-date" }] },
  ])("rejects invalid data instead of showing false locked states", (value) => {
    expect(() => parseAchievements(value)).toThrow();
  });
});
