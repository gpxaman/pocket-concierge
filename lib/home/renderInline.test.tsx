import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { renderInline } from "@/lib/home/renderInline";

describe("renderInline", () => {
  it("renders plain text unchanged", () => {
    const { container } = render(<>{renderInline("just plain text")}</>);
    expect(container.textContent).toBe("just plain text");
  });

  it("renders **bold** markers as <strong> and strips the asterisks", () => {
    const { container } = render(<>{renderInline("this is **bold** text")}</>);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("bold");
    expect(container.textContent).toBe("this is bold text");
  });

  it("normalizes a leading '* ' bullet marker into a bullet glyph", () => {
    const { container } = render(<>{renderInline("* first item\n* second item")}</>);
    expect(container.textContent).toContain("• first item");
    expect(container.textContent).toContain("• second item");
  });

  it("does not touch ** that isn't part of a matched pair", () => {
    const { container } = render(<>{renderInline("2 ** 3 is not markdown")}</>);
    expect(container.querySelector("strong")).toBeNull();
  });
});
