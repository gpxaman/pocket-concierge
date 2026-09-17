import { describe, expect, it } from "vitest";
import { detectBrand, isValidCardNumber, isValidExpiry, last4Of } from "@/lib/payments";

describe("detectBrand", () => {
  it("detects visa (starts with 4)", () => {
    expect(detectBrand("4111 1111 1111 1111")).toBe("visa");
  });

  it("detects mastercard (51-55 or 22-27)", () => {
    expect(detectBrand("5500 0000 0000 0004")).toBe("mastercard");
    expect(detectBrand("2223 0000 0000 0000")).toBe("mastercard");
  });

  it("detects amex (34 or 37)", () => {
    expect(detectBrand("3714 496353 98431")).toBe("amex");
  });

  it("detects rupay (starts with 6)", () => {
    expect(detectBrand("6070 0000 0000 0000")).toBe("rupay");
  });

  it("falls back to generic card for unrecognized prefixes", () => {
    expect(detectBrand("9999 0000 0000 0000")).toBe("card");
  });
});

describe("last4Of", () => {
  it("returns the last 4 digits, ignoring non-digit characters", () => {
    expect(last4Of("4111 1111 1111 1234")).toBe("1234");
  });

  it("pads shorter numbers with leading zeros", () => {
    expect(last4Of("42")).toBe("0042");
  });
});

describe("isValidCardNumber", () => {
  it("accepts numbers with 12-19 digits", () => {
    expect(isValidCardNumber("4111111111111111")).toBe(true);
    expect(isValidCardNumber("411111111111")).toBe(true);
  });

  it("rejects numbers shorter than 12 or longer than 19 digits", () => {
    expect(isValidCardNumber("4111")).toBe(false);
    expect(isValidCardNumber("41111111111111111111")).toBe(false);
  });
});

describe("isValidExpiry", () => {
  it("rejects malformed input", () => {
    expect(isValidExpiry("13/25")).toBe(false); // invalid month
    expect(isValidExpiry("not-a-date")).toBe(false);
    expect(isValidExpiry("1/25")).toBe(false); // wrong digit count
  });

  it("rejects an already-expired month/year", () => {
    expect(isValidExpiry("01/20")).toBe(false);
  });

  it("accepts a valid, non-expired future expiry", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 5);
    const mm = String(future.getMonth() + 1).padStart(2, "0");
    const yy = String(future.getFullYear() % 100).padStart(2, "0");
    expect(isValidExpiry(`${mm}/${yy}`)).toBe(true);
  });
});
