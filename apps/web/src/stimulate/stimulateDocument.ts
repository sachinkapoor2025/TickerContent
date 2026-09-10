import { type ColorMode, type CompositionDocument } from "@ticker-cms/composition";
import {
  LED_MATRIX_HEIGHT,
  LED_MATRIX_WIDTH,
  LED_MONO_COLOR,
  LED_OFF_THRESHOLD,
} from "../components/ledPresentation";

export const STIMULATE_WIDTH = LED_MATRIX_WIDTH;
export const STIMULATE_HEIGHT = LED_MATRIX_HEIGHT;
export const STIMULATE_DEFAULT_MESSAGE = "Happy Diwali! 🪔✨";
export const STIMULATE_MONO_COLOR = LED_MONO_COLOR;
export { LED_OFF_THRESHOLD };

export const STIMULATE_COLORS = [
  { id: "red", label: "Red", value: "#FF2A2A" },
  { id: "green", label: "Green", value: "#39D353" },
  { id: "blue", label: "Blue", value: "#3B82FF" },
  { id: "amber", label: "Amber", value: "#FFBF00" },
  { id: "cyan", label: "Cyan", value: "#22D3EE" },
  { id: "pink", label: "Pink", value: "#FF4F9A" },
] as const;

export type StimulateColorId = (typeof STIMULATE_COLORS)[number]["id"];
export type StimulateMode = "full" | "mono";
export type StimulateAnimation = "static" | "scroll";

export type StimulateSettings = {
  message: string;
  mode: StimulateMode;
  colorId: StimulateColorId;
  animation: StimulateAnimation;
};

export const STIMULATE_DEFAULTS: StimulateSettings = {
  message: STIMULATE_DEFAULT_MESSAGE,
  mode: "full",
  colorId: "amber",
  animation: "scroll",
};

const EMOJI_GRAPHEME = /\p{Extended_Pictographic}/u;
const MISSING_GLYPH = "◆";

export function colorValue(colorId: StimulateColorId): string {
  return STIMULATE_COLORS.find((color) => color.id === colorId)?.value ?? STIMULATE_COLORS[3].value;
}

export function ledTextColor(settings: Pick<StimulateSettings, "mode" | "colorId">): string {
  return settings.mode === "mono" ? STIMULATE_MONO_COLOR : colorValue(settings.colorId);
}

export function prepareStimulateMessage(input: string): string {
  return input.normalize("NFC").replaceAll("\uFFFD", "").replaceAll("\u0000", "");
}

export function replaceUnsupportedGraphemes(text: string, isSupported: (grapheme: string) => boolean): string {
  if (typeof Intl.Segmenter !== "function") {
    return isSupported(text) ? text : MISSING_GLYPH;
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  let out = "";
  for (const { segment } of segmenter.segment(text)) {
    if (!segment) continue;
    if (isSupported(segment)) {
      out += segment;
      continue;
    }
    out += EMOJI_GRAPHEME.test(segment) ? MISSING_GLYPH : segment;
  }
  return out;
}

export function canvasGlyphSupported(ctx: CanvasRenderingContext2D, grapheme: string): boolean {
  if (grapheme.trim() === "") return true;
  const width = ctx.measureText(grapheme).width;
  if (width <= 0) return false;
  const missing = ctx.measureText("\uFFFD").width;
  if (EMOJI_GRAPHEME.test(grapheme) && Math.abs(width - missing) < 0.5 && grapheme !== "\uFFFD") {
    return false;
  }
  return true;
}

export function buildStimulateDocument(
  settings: StimulateSettings,
  message = prepareStimulateMessage(settings.message),
): CompositionDocument {
  const colorMode: ColorMode = settings.mode === "mono" ? "mono" : "full";
  const color = ledTextColor(settings);
  const fontPx = STIMULATE_HEIGHT - 8;
  const scrolling = settings.animation === "scroll";
  return {
    schemaVersion: "1",
    profile: { width: STIMULATE_WIDTH, height: STIMULATE_HEIGHT, colorMode },
    layers: [
      { id: "bg", type: "fill", zIndex: 0, props: { color: "#000000" } },
      {
        id: "headline",
        type: "text",
        zIndex: 10,
        x: scrolling ? undefined : 12,
        y: scrolling ? undefined : STIMULATE_HEIGHT / 2,
        props: {
          text: message,
          color,
          fontPx,
          scrollPxPerSec: scrolling ? Math.max(40, Math.round(STIMULATE_WIDTH / 8)) : 0,
        },
      },
    ],
  };
}
