import { describe, expect, it } from "vitest";
import { ownsSales } from "./salesOwner.js";

describe("ownsSales", () => {
  it("is false for an empty title", () => {
    expect(ownsSales("")).toBe(false);
  });

  it("is false for Co-Founder, CTO", () => {
    expect(ownsSales("Co-Founder, CTO")).toBe(false);
  });

  it("is true for Head of Sales", () => {
    expect(ownsSales("Head of Sales")).toBe(true);
  });

  it("is true for Founder and CEO", () => {
    expect(ownsSales("Founder and CEO")).toBe(true);
  });

  it("is true for VP of Sales", () => {
    expect(ownsSales("VP of Sales")).toBe(true);
  });

  it("is false for Chief Technology Officer", () => {
    expect(ownsSales("Chief Technology Officer")).toBe(false);
  });
});
