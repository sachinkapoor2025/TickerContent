import { describe, expect, it } from "vitest";
import {
  LED_GAP,
  LED_MATRIX_HEIGHT,
  LED_MATRIX_WIDTH,
  LED_MONO_COLOR,
  LED_OFF_THRESHOLD,
  LED_PITCH,
  LED_PIXEL_SIZE,
  asCompositionDocument,
  blitLedMosaic,
  ledGapForCell,
  ledMosaicLayout,
  ledMonoColor,
  quantizeLedPixels,
  tickerDisplayProfile,
} from "./ledPresentation";

describe("shared LED ticker presentation", () => {
  it("keeps the 620×64 matrix with 2px LED, 2px gap, and hard cutoff", () => {
    expect(LED_MATRIX_WIDTH).toBe(620);
    expect(LED_MATRIX_HEIGHT).toBe(64);
    expect(LED_PIXEL_SIZE).toBe(2);
    expect(LED_GAP).toBe(2);
    expect(LED_PITCH).toBe(4);
    expect(LED_OFF_THRESHOLD).toBe(90);
  });

  it("quantizes dim anti-aliased pixels off and snaps remaining mono pixels", () => {
    const data = new Uint8ClampedArray([
      4, 4, 4, 40, 255, 191, 0, 180, 220, 180, 20, 255,
    ]);
    quantizeLedPixels(data, { mono: true, monoColor: LED_MONO_COLOR });
    expect(Array.from(data.slice(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(data.slice(4, 8))).toEqual([255, 191, 0, 255]);
    expect(Array.from(data.slice(8, 12))).toEqual([255, 191, 0, 255]);
  });

  it("matches the demo 2px LED + 2px gap pitch on a 620×64 matrix", () => {
    const compact = ledMosaicLayout(390);
    expect(compact.cell).toBe(4);
    expect(compact.gap).toBe(2);
    expect(compact.width / compact.cell).toBe(LED_MATRIX_WIDTH);
    expect(compact.height / compact.cell).toBe(LED_MATRIX_HEIGHT);
    expect(ledGapForCell(2)).toBe(1);
    expect(ledGapForCell(4)).toBe(2);
    const wide = ledMosaicLayout(3100);
    expect(wide.cell).toBe(5);
    expect(wide.gap).toBe(2);
  });

  it("draws the demo-style gap overlay after nearest-neighbor scale", () => {
    const fills: Array<{ color: unknown; x: number; y: number; w: number; h: number }> = [];
    const images: Array<{ w: number; h: number }> = [];
    const dest = {
      imageSmoothingEnabled: true,
      fillStyle: "",
      fillRect: (x: number, y: number, w: number, h: number) => {
        fills.push({ color: dest.fillStyle, x, y, w, h });
      },
      drawImage: (_src: unknown, _sx: number, _sy: number, _sw: number, _sh: number, _dx: number, _dy: number, w: number, h: number) => {
        images.push({ w, h });
      },
    } as unknown as CanvasRenderingContext2D;
    blitLedMosaic({} as CanvasImageSource, dest, { cell: 4, gap: 2, width: 8, height: 8 });
    expect(images).toEqual([{ w: 8, h: 8 }]);
    expect(fills[0]).toMatchObject({ color: "#000000", x: 0, y: 0, w: 8, h: 8 });
    expect(fills.some((item) => item.x === 2 && item.w === 2 && item.h === 8)).toBe(true);
    expect(fills.some((item) => item.y === 2 && item.h === 2 && item.w === 8)).toBe(true);
  });

  it("accepts a real composition document and uses its profile", () => {
    const document = asCompositionDocument({
      schemaVersion: "1",
      profile: { width: 620, height: 64, colorMode: "mono" },
      layers: [{ id: "t", type: "text", props: { text: "Hi", color: "#22D3EE" } }],
    });
    expect(document?.profile).toEqual({ width: 620, height: 64, colorMode: "mono" });
    expect(ledMonoColor(document!)).toBe("#22D3EE");
    expect(tickerDisplayProfile(null, { width: 128, height: 32, colorMode: "full" })).toEqual({
      width: 128,
      height: 32,
      colorMode: "full",
    });
    expect(asCompositionDocument({ layers: [] })).toBeNull();
    expect(
      asCompositionDocument({
        schemaVersion: 1,
        profile: { width: 620, height: 64, colorMode: "full" },
        layers: [],
      })?.profile.width,
    ).toBe(620);
  });
});
