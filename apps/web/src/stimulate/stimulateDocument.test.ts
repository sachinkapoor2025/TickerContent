import { describe, expect, it } from "vitest";
import {
  STIMULATE_DEFAULTS,
  STIMULATE_HEIGHT,
  STIMULATE_MONO_COLOR,
  STIMULATE_WIDTH,
  buildStimulateDocument,
  canvasGlyphSupported,
  colorValue,
  ledTextColor,
  prepareStimulateMessage,
  replaceUnsupportedGraphemes,
} from "./stimulateDocument";

describe("stimulate document", () => {
  it("uses the 620×64 matrix, default Diwali copy, and origin-root playback colors", () => {
    const doc = buildStimulateDocument(STIMULATE_DEFAULTS);
    expect(doc.profile).toEqual({ width: STIMULATE_WIDTH, height: STIMULATE_HEIGHT, colorMode: "full" });
    const text = doc.layers.find((layer) => layer.type === "text");
    expect(text?.type).toBe("text");
    if (text?.type !== "text") return;
    expect(text.props.text).toBe("Happy Diwali! 🪔✨");
    expect(text.props.color).toBe(colorValue("amber"));
    expect(text.props.scrollPxPerSec).toBeGreaterThan(0);
    expect(text.x).toBeUndefined();
  });

  it("keeps static text parked on the matrix and mono on a single LED color", () => {
    const doc = buildStimulateDocument({
      message: "Hello",
      mode: "mono",
      colorId: "blue",
      animation: "static",
    });
    expect(doc.profile.colorMode).toBe("mono");
    const text = doc.layers.find((layer) => layer.type === "text");
    if (text?.type !== "text") throw new Error("expected text");
    expect(text.props.color).toBe(STIMULATE_MONO_COLOR);
    expect(text.props.scrollPxPerSec).toBe(0);
    expect(text.x).toBe(12);
    expect(ledTextColor({ mode: "full", colorId: "pink" })).toBe(colorValue("pink"));
  });

  it("strips missing-glyph markers and keeps emoji in the message", () => {
    expect(prepareStimulateMessage("Hi \uFFFD🪔")).toBe("Hi 🪔");
    expect(replaceUnsupportedGraphemes("A🪔B", (g) => g !== "🪔")).toBe("A◆B");
    expect(replaceUnsupportedGraphemes("Hello", () => true)).toBe("Hello");
  });

  it("treats zero-width canvas measurements as unsupported glyphs", () => {
    const ctx = {
      measureText: (value: string) => ({ width: value === "x" ? 0 : 10 }),
    } as unknown as CanvasRenderingContext2D;
    expect(canvasGlyphSupported(ctx, "x")).toBe(false);
    expect(canvasGlyphSupported(ctx, "A")).toBe(true);
    expect(canvasGlyphSupported(ctx, " ")).toBe(true);
  });
});
