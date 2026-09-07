import { describe, expect, it } from "vitest";
import { createDemoDocument, snapToLed } from "./index.js";

describe("snapToLed", () => {
  it("rounds to integer LED columns", () => {
    expect(snapToLed(10.4)).toBe(10);
    expect(snapToLed(10.6)).toBe(11);
  });
});

describe("createDemoDocument", () => {
  it("uses the device profile", () => {
    const doc = createDemoDocument({ width: 993, height: 32, colorMode: "full" }, "Hello");
    expect(doc.profile.width).toBe(993);
    expect(doc.layers[0]?.type).toBe("fill");
  });
});
