import { describe, expect, it } from "vitest";
import { BUILTIN_PRESETS, filterToCss, NEUTRAL_FILTER } from "@/lib/filters";

describe("filterToCss", () => {
  it("renders the neutral filter as a CSS filter string with no visible effect", () => {
    expect(filterToCss(NEUTRAL_FILTER)).toBe(
      "brightness(100%) contrast(100%) saturate(100%) hue-rotate(0deg) sepia(0%) grayscale(0%)"
    );
  });

  it("renders every filter dimension for a non-neutral preset", () => {
    const css = filterToCss({ brightness: 106, contrast: 104, saturation: 122, hueRotate: -8, sepia: 18, grayscale: 0 });
    expect(css).toBe("brightness(106%) contrast(104%) saturate(122%) hue-rotate(-8deg) sepia(18%) grayscale(0%)");
  });
});

describe("BUILTIN_PRESETS", () => {
  it("has unique ids", () => {
    const ids = BUILTIN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes a 'none' preset matching the neutral filter", () => {
    const none = BUILTIN_PRESETS.find((p) => p.id === "none");
    expect(none).toMatchObject(NEUTRAL_FILTER);
  });
});
