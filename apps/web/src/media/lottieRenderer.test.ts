import type { LottieRenderRequest } from "@ticker-cms/composition";
import { describe, expect, it } from "vitest";
import { createLottieRenderer } from "./lottieRenderer.js";
import { lottieFrameIndex } from "./lottieTime.js";

describe("lottieFrameIndex", () => {
  it("wraps when loop is true", () => {
    expect(lottieFrameIndex(2000, 30, 30, true)).toBe(0);
    expect(lottieFrameIndex(500, 30, 30, true)).toBe(15);
  });

  it("clamps when loop is false", () => {
    expect(lottieFrameIndex(5000, 30, 30, false)).toBe(29);
    expect(lottieFrameIndex(0, 30, 30, false)).toBe(0);
  });
});

describe("createLottieRenderer", () => {
  it("returns null when the animation JSON is not loaded", () => {
    const render = createLottieRenderer(new Map());
    const request: LottieRenderRequest = {
      assetId: "missing",
      timeMs: 0,
      width: 32,
      height: 32,
      layer: { id: "lot", type: "lottie", assetId: "missing" },
    };
    expect(render(request)).toBeNull();
  });
});
