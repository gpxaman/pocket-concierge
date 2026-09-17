import { describe, expect, it } from "vitest";
import { nextTier, pointsForAmount, progressToNextTier, tierForPoints } from "@/lib/loyalty";

describe("pointsForAmount", () => {
  it("awards 1 point per ₹10 spent, floored", () => {
    expect(pointsForAmount(100)).toBe(10);
    expect(pointsForAmount(95)).toBe(9);
    expect(pointsForAmount(0)).toBe(0);
  });
});

describe("tierForPoints", () => {
  it("returns Bronze below the Silver threshold", () => {
    expect(tierForPoints(0).id).toBe("bronze");
    expect(tierForPoints(499).id).toBe("bronze");
  });

  it("returns the exact tier at its threshold boundary", () => {
    expect(tierForPoints(500).id).toBe("silver");
    expect(tierForPoints(1500).id).toBe("gold");
    expect(tierForPoints(4000).id).toBe("platinum");
    expect(tierForPoints(10000).id).toBe("diamond");
  });

  it("returns the top tier for any points beyond it", () => {
    expect(tierForPoints(999_999).id).toBe("diamond");
  });
});

describe("nextTier", () => {
  it("returns the tier immediately above the current one", () => {
    expect(nextTier(0)?.id).toBe("silver");
    expect(nextTier(500)?.id).toBe("gold");
  });

  it("returns null once at the top tier", () => {
    expect(nextTier(10000)).toBeNull();
  });
});

describe("progressToNextTier", () => {
  it("is 0 right at a tier's own threshold", () => {
    expect(progressToNextTier(500)).toBe(0);
  });

  it("is 1 once at the top tier", () => {
    expect(progressToNextTier(10000)).toBe(1);
  });

  it("is a fraction between 0 and 1 partway to the next tier", () => {
    // Bronze (0) -> Silver (500): halfway is 250 points
    expect(progressToNextTier(250)).toBeCloseTo(0.5);
  });
});
