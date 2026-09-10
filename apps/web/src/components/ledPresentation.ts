import type { ColorMode, CompositionDocument, DisplayProfile } from "@ticker-cms/composition";

export const LED_MATRIX_WIDTH = 620;
export const LED_MATRIX_HEIGHT = 64;
export const LED_PIXEL_SIZE = 2;
export const LED_GAP = 2;
export const LED_PITCH = LED_PIXEL_SIZE + LED_GAP;
export const LED_GAP_FILL = "rgba(0,0,0,0.55)";
export const LED_OFF_THRESHOLD = 90;
export const LED_MOSAIC_MIN_CELL = 4;
export const LED_MONO_COLOR = "#FFBF00";
export const LED_PANEL_COLOR = "#070605";

export type TickerDisplayScale = "responsive" | "compact" | "large";

export type LedMosaicLayout = {
  cell: number;
  gap: number;
  width: number;
  height: number;
};

export function ledGapForCell(cell: number): number {
  return cell >= 2 ? Math.floor(cell / 2) : 0;
}

export function ledMosaicLayout(
  cssWidth: number,
  cols = LED_MATRIX_WIDTH,
  rows = LED_MATRIX_HEIGHT,
): LedMosaicLayout {
  const fitted = Math.floor(Math.max(0, cssWidth) / cols);
  const cell = Math.max(LED_MOSAIC_MIN_CELL, fitted);
  const gap = ledGapForCell(cell);
  return {
    cell,
    gap,
    width: cols * cell,
    height: rows * cell,
  };
}

export function paintLedGapOverlay(
  ctx: CanvasRenderingContext2D,
  displayW: number,
  displayH: number,
  cols: number,
  rows: number,
  pitch: number,
  gap: number,
): void {
  if (gap <= 0) return;
  ctx.fillStyle = LED_GAP_FILL;
  for (let c = 1; c < cols; c += 1) {
    ctx.fillRect(c * pitch - gap, 0, gap, displayH);
  }
  for (let r = 1; r < rows; r += 1) {
    ctx.fillRect(0, r * pitch - gap, displayW, gap);
  }
}

export function blitLedMosaic(
  source: CanvasImageSource,
  dest: CanvasRenderingContext2D,
  layout: LedMosaicLayout,
  cols = LED_MATRIX_WIDTH,
  rows = LED_MATRIX_HEIGHT,
): void {
  dest.imageSmoothingEnabled = false;
  dest.fillStyle = "#000000";
  dest.fillRect(0, 0, layout.width, layout.height);
  dest.drawImage(source, 0, 0, cols, rows, 0, 0, layout.width, layout.height);
  if (layout.gap <= 0) return;
  dest.fillStyle = LED_GAP_FILL;
  paintLedGapOverlay(dest, layout.width, layout.height, cols, rows, layout.cell, layout.gap);
}

export function layoutGapOverlay(
  overlay: HTMLCanvasElement,
  cols: number,
  rows: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  const displayW = Math.max(1, cols * LED_PITCH);
  const displayH = Math.max(1, rows * LED_PITCH);
  overlay.width = Math.max(1, Math.round(displayW * dpr));
  overlay.height = Math.max(1, Math.round(displayH * dpr));
  const ctx = overlay.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, displayW, displayH);
  paintLedGapOverlay(ctx, displayW, displayH, cols, rows, LED_PITCH, LED_GAP);
}

function parseRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

export function quantizeLedPixels(
  data: Uint8ClampedArray,
  options: { mono?: boolean; monoColor?: string } = {},
): void {
  const monoRgb = options.mono ? parseRgb(options.monoColor ?? LED_MONO_COLOR) : null;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = data[i + 3] ?? 0;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < LED_OFF_THRESHOLD || a < 20) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
      continue;
    }
    if (monoRgb) {
      data[i] = monoRgb[0];
      data[i + 1] = monoRgb[1];
      data[i + 2] = monoRgb[2];
    }
    data[i + 3] = 255;
  }
}

export function isColorMode(value: unknown): value is ColorMode {
  return value === "full" || value === "mono" || value === "rg";
}

export function asDisplayProfile(value: unknown, fallback?: DisplayProfile | null): DisplayProfile {
  if (value && typeof value === "object") {
    const profile = value as Partial<DisplayProfile>;
    const width = typeof profile.width === "number" && profile.width > 0 ? profile.width : fallback?.width;
    const height = typeof profile.height === "number" && profile.height > 0 ? profile.height : fallback?.height;
    const colorMode = isColorMode(profile.colorMode) ? profile.colorMode : fallback?.colorMode;
    if (width && height && colorMode) {
      return { width, height, colorMode };
    }
  }
  return fallback ?? { width: LED_MATRIX_WIDTH, height: LED_MATRIX_HEIGHT, colorMode: "full" };
}

export function asCompositionDocument(value: unknown): CompositionDocument | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Partial<CompositionDocument>;
  if (!Array.isArray(doc.layers) || !doc.profile) return null;
  const profile = asDisplayProfile(doc.profile, null);
  if (profile.width < 1 || profile.height < 1) return null;
  return {
    schemaVersion: "1",
    profile,
    layers: doc.layers as CompositionDocument["layers"],
  };
}

export function ledMonoColor(document: CompositionDocument): string {
  const text = document.layers.find((layer) => layer.type === "text");
  if (text?.type === "text" && typeof text.props.color === "string" && text.props.color.trim()) {
    return text.props.color;
  }
  return LED_MONO_COLOR;
}

export function tickerDisplayProfile(
  document: CompositionDocument | null | undefined,
  profile?: DisplayProfile | null,
): DisplayProfile {
  if (document) return document.profile;
  return asDisplayProfile(profile, null);
}
