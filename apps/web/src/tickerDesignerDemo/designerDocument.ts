import { LED_TEXT_FONT_STACK, type ColorMode, type CompositionDocument, type Layer } from "@ticker-cms/composition";
import { LED_MATRIX_HEIGHT, LED_MATRIX_WIDTH } from "../components/ledPresentation";
import {
  STIMULATE_COLORS,
  canvasGlyphSupported,
  colorValue,
  prepareStimulateMessage,
  replaceUnsupportedGraphemes,
  type StimulateColorId,
} from "../stimulate/stimulateDocument";

export const DESIGNER_WIDTH = LED_MATRIX_WIDTH;
export const DESIGNER_HEIGHT = LED_MATRIX_HEIGHT;
export const DESIGNER_DISPLAY_SIZE_LABEL = `${DESIGNER_WIDTH} × ${DESIGNER_HEIGHT}`;
export const DESIGNER_COLORS = STIMULATE_COLORS;
export const DESIGNER_DEFAULT_NAME = "Lobby Ticker";

export type DesignerColorId = StimulateColorId;
export type DesignerColorMode = "rgb" | "mono";
export type DesignerAnimationKind = "static" | "dynamic";
export type DesignerMovement = "scroll";
export type DesignerOccasion = "christmas" | "diwali" | "halloween" | "newYear";
export type DesignerEffectId = "snow" | "santa" | "diyas" | "sparkles" | "pumpkin" | "ghost" | "fireworks" | "confetti";
export type DesignerEffect = DesignerEffectId | "none";
export type DesignerApiMethod = "GET";
export type DesignerNodeKind = "text" | "emoji" | "animation" | "color" | "effect" | "api";

export type DesignerEmojiItem = { glyph: string; keywords: string[] };
export type DesignerEmojiGroup = { id: string; label: string; items: DesignerEmojiItem[] };

export const DESIGNER_EMOJI_GROUPS: DesignerEmojiGroup[] = [
  {
    id: "frequent",
    label: "Frequently Used",
    items: [
      { glyph: "😀", keywords: ["smile", "face", "happy"] },
      { glyph: "❤️", keywords: ["heart", "love"] },
      { glyph: "⭐", keywords: ["star"] },
      { glyph: "✨", keywords: ["sparkle", "stars"] },
      { glyph: "👍", keywords: ["thumbs", "yes", "like"] },
    ],
  },
  {
    id: "celebration",
    label: "Celebration",
    items: [
      { glyph: "🎉", keywords: ["party", "confetti"] },
      { glyph: "🎊", keywords: ["confetti", "ball"] },
      { glyph: "🥳", keywords: ["party", "face"] },
      { glyph: "🎂", keywords: ["cake", "birthday"] },
      { glyph: "🎈", keywords: ["balloon"] },
    ],
  },
  {
    id: "festivals",
    label: "Festivals",
    items: [
      { glyph: "🪔", keywords: ["diya", "diwali"] },
      { glyph: "🎄", keywords: ["tree", "christmas"] },
      { glyph: "🎃", keywords: ["pumpkin", "halloween"] },
      { glyph: "🎆", keywords: ["fireworks"] },
      { glyph: "🎁", keywords: ["gift", "present"] },
      { glyph: "❄️", keywords: ["snow", "cold"] },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    items: [
      { glyph: "🌸", keywords: ["flower", "blossom"] },
      { glyph: "🌻", keywords: ["sunflower"] },
      { glyph: "🌈", keywords: ["rainbow"] },
      { glyph: "🌙", keywords: ["moon"] },
      { glyph: "☀️", keywords: ["sun"] },
    ],
  },
  {
    id: "food",
    label: "Food",
    items: [
      { glyph: "🍕", keywords: ["pizza"] },
      { glyph: "🍔", keywords: ["burger"] },
      { glyph: "🍰", keywords: ["cake"] },
      { glyph: "🍎", keywords: ["apple"] },
      { glyph: "☕", keywords: ["coffee"] },
    ],
  },
  {
    id: "hearts",
    label: "Hearts",
    items: [
      { glyph: "❤️", keywords: ["red", "love"] },
      { glyph: "🧡", keywords: ["orange"] },
      { glyph: "💛", keywords: ["yellow"] },
      { glyph: "💚", keywords: ["green"] },
      { glyph: "💙", keywords: ["blue"] },
      { glyph: "💜", keywords: ["purple"] },
      { glyph: "💖", keywords: ["sparkling", "pink"] },
    ],
  },
  {
    id: "objects",
    label: "Objects",
    items: [
      { glyph: "🎁", keywords: ["gift", "present"] },
      { glyph: "🎈", keywords: ["balloon"] },
      { glyph: "🚀", keywords: ["rocket"] },
      { glyph: "⭐", keywords: ["star"] },
      { glyph: "🔔", keywords: ["bell"] },
      { glyph: "📡", keywords: ["antenna", "signal", "status"] },
      { glyph: "🌡️", keywords: ["thermometer", "temperature"] },
    ],
  },
  {
    id: "people",
    label: "People",
    items: [
      { glyph: "😀", keywords: ["smile", "face"] },
      { glyph: "😎", keywords: ["cool", "sunglasses"] },
      { glyph: "🤗", keywords: ["hug"] },
      { glyph: "🙌", keywords: ["hands", "celebrate"] },
      { glyph: "👋", keywords: ["wave", "hello"] },
    ],
  },
];

export type DesignerOccasionOption = { id: DesignerOccasion; label: string };
export type DesignerEffectOption = {
  id: DesignerEffectId;
  occasion: DesignerOccasion;
  label: string;
  mark: string;
  ready: boolean;
};

export const DESIGNER_OCCASIONS: DesignerOccasionOption[] = [
  { id: "christmas", label: "Christmas" },
  { id: "diwali", label: "Diwali" },
  { id: "halloween", label: "Halloween" },
  { id: "newYear", label: "New Year" },
];

export const DESIGNER_EFFECT_OPTIONS: DesignerEffectOption[] = [
  { id: "snow", occasion: "christmas", label: "Snow", mark: "❄️", ready: true },
  { id: "santa", occasion: "christmas", label: "Santa", mark: "🎅", ready: true },
  { id: "diyas", occasion: "diwali", label: "Diyas", mark: "🪔", ready: true },
  { id: "sparkles", occasion: "diwali", label: "Sparkles", mark: "✨", ready: true },
  { id: "pumpkin", occasion: "halloween", label: "Pumpkin", mark: "🎃", ready: true },
  { id: "ghost", occasion: "halloween", label: "Ghost", mark: "👻", ready: true },
  { id: "fireworks", occasion: "newYear", label: "Fireworks", mark: "🎆", ready: true },
  { id: "confetti", occasion: "newYear", label: "Confetti", mark: "🎊", ready: true },
];

export const DESIGNER_API_METHODS: DesignerApiMethod[] = ["GET"];
export const DESIGNER_API_REFRESH_SECONDS = [15, 30, 60] as const;
export const DESIGNER_API_DEFAULT_URL = "https://example.com/ticker";
export const DESIGNER_API_DEFAULT_FIELD = "message";
export const DESIGNER_API_DEFAULT_MOCK = "Welcome to Photonplay";

export type DesignerTextNode = { id: string; kind: "text"; text: string };
export type DesignerEmojiNode = { id: string; kind: "emoji"; emoji: string };
export type DesignerAnimationNode = {
  id: string;
  kind: "animation";
  animationKind: DesignerAnimationKind;
  movement: DesignerMovement;
};
export type DesignerColorNode = {
  id: string;
  kind: "color";
  colorMode: DesignerColorMode;
  colorId: DesignerColorId;
};
export type DesignerEffectNode = {
  id: string;
  kind: "effect";
  occasion: DesignerOccasion;
  effect: DesignerEffectId;
};
export type DesignerApiNode = {
  id: string;
  kind: "api";
  url: string;
  field: string;
  method: DesignerApiMethod;
  refreshSeconds: number;
  connected: boolean;
  mockValue: string;
};
export type DesignerNode =
  | DesignerTextNode
  | DesignerEmojiNode
  | DesignerAnimationNode
  | DesignerColorNode
  | DesignerEffectNode
  | DesignerApiNode;

export type DesignerPlayback = {
  message: string;
  animationKind: DesignerAnimationKind;
  movement: DesignerMovement;
  colorMode: DesignerColorMode;
  colorId: DesignerColorId;
  effect: DesignerEffect;
};

export const DESIGNER_ADD_ITEMS: { kind: DesignerNodeKind; label: string; mark: string }[] = [
  { kind: "text", label: "Text", mark: "T" },
  { kind: "emoji", label: "Emoji", mark: "☺" },
  { kind: "animation", label: "Animation", mark: "↔" },
  { kind: "color", label: "Color", mark: "◉" },
  { kind: "effect", label: "Effect", mark: "✦" },
  { kind: "api", label: "API", mark: "{}" },
];

export const DESIGNER_SAVE_TOAST = "✓ Saved";
export const DESIGNER_PUBLISH_TOAST = "✓ Published";
export const DESIGNER_SCHEDULE_TOAST = "✓ Schedule saved";
export const DESIGNER_API_TEST_TOAST = "✓ Demo connection successful";
export const DESIGNER_TOAST_MS = 2200;

export function createInitialFlow(): DesignerNode[] {
  return [];
}

export function createDesignerNode(kind: DesignerNodeKind, id: string): DesignerNode {
  if (kind === "text") return { id, kind, text: "" };
  if (kind === "emoji") return { id, kind, emoji: "" };
  if (kind === "animation") return { id, kind, animationKind: "static", movement: "scroll" };
  if (kind === "color") return { id, kind, colorMode: "rgb", colorId: "amber" };
  if (kind === "api") {
    return {
      id,
      kind,
      url: DESIGNER_API_DEFAULT_URL,
      field: DESIGNER_API_DEFAULT_FIELD,
      method: "GET",
      refreshSeconds: 30,
      connected: false,
      mockValue: DESIGNER_API_DEFAULT_MOCK,
    };
  }
  return { id, kind, occasion: "christmas", effect: "snow" };
}

export function appendDesignerNode(nodes: DesignerNode[], kind: DesignerNodeKind, id: string): DesignerNode[] {
  return [...nodes, createDesignerNode(kind, id)];
}

export function removeDesignerNode(nodes: DesignerNode[], id: string): DesignerNode[] {
  return nodes.filter((node) => node.id !== id);
}

export function clearSelectedNode(
  nodes: DesignerNode[],
  selectedId: string | null,
): { nodes: DesignerNode[]; selectedId: null } {
  if (!selectedId) return { nodes, selectedId: null };
  return { nodes: removeDesignerNode(nodes, selectedId), selectedId: null };
}

export function clearAllNodes(): DesignerNode[] {
  return createInitialFlow();
}

export function nodeKindLabel(kind: DesignerNodeKind): string {
  if (kind === "api") return "API";
  return `${kind[0]!.toUpperCase()}${kind.slice(1)}`;
}

export function nextSelectedId(nodes: DesignerNode[], removedId: string, selectedId: string | null): string | null {
  const remaining = removeDesignerNode(nodes, removedId);
  if (selectedId && selectedId !== removedId) {
    return remaining.some((node) => node.id === selectedId) ? selectedId : null;
  }
  const index = nodes.findIndex((node) => node.id === removedId);
  if (index < 0) return selectedId;
  return remaining[index]?.id ?? remaining[index - 1]?.id ?? null;
}

export function apiFieldName(node: Pick<DesignerApiNode, "field">): string {
  const field = node.field.trim();
  return field || DESIGNER_API_DEFAULT_FIELD;
}

export function apiTickerValue(node: DesignerApiNode): string {
  if (!node.connected) return "";
  const value = prepareDesignerMessage(node.mockValue.trim());
  return value;
}

export function mockApiPayload(node: DesignerApiNode): Record<string, string> {
  return { [apiFieldName(node)]: node.mockValue };
}

export function mockApiJson(node: DesignerApiNode): string {
  return JSON.stringify(mockApiPayload(node), null, 2);
}

export function connectDesignerApi(node: DesignerApiNode): DesignerApiNode {
  return { ...node, connected: true };
}

export function composeFlowMessage(nodes: DesignerNode[]): string {
  return nodes
    .flatMap((node) => {
      if (node.kind === "text") return node.text.trim() ? [prepareDesignerMessage(node.text.trim())] : [];
      if (node.kind === "emoji") return node.emoji.trim() ? [node.emoji.trim()] : [];
      if (node.kind === "api") {
        const value = apiTickerValue(node);
        return value ? [value] : [];
      }
      return [];
    })
    .join(" ");
}

export function lastNodeOfKind<K extends DesignerNodeKind>(
  nodes: DesignerNode[],
  kind: K,
): Extract<DesignerNode, { kind: K }> | undefined {
  return [...nodes].reverse().find((node): node is Extract<DesignerNode, { kind: K }> => node.kind === kind);
}

export function resolveFlowPlayback(nodes: DesignerNode[]): DesignerPlayback {
  const animation = lastNodeOfKind(nodes, "animation");
  const color = lastNodeOfKind(nodes, "color");
  const effect = lastNodeOfKind(nodes, "effect");
  return {
    message: composeFlowMessage(nodes),
    animationKind: animation?.animationKind ?? "static",
    movement: animation?.movement ?? "scroll",
    colorMode: color?.colorMode ?? "rgb",
    colorId: color?.colorId ?? "amber",
    effect: effect?.effect ?? "none",
  };
}

export function designerProfileColorMode(mode: DesignerColorMode): ColorMode {
  return mode === "mono" ? "mono" : "full";
}

export function designerTextColor(colorId: DesignerColorId): string {
  return colorValue(colorId);
}

export function designerScrolling(playback: Pick<DesignerPlayback, "animationKind" | "movement">): boolean {
  return playback.animationKind === "dynamic" && playback.movement === "scroll";
}

export function prepareDesignerMessage(input: string): string {
  return prepareStimulateMessage(input);
}

export function effectsForOccasion(occasion: DesignerOccasion): DesignerEffectOption[] {
  return DESIGNER_EFFECT_OPTIONS.filter((option) => option.occasion === occasion);
}

export function effectOption(id: DesignerEffectId): DesignerEffectOption | undefined {
  return DESIGNER_EFFECT_OPTIONS.find((option) => option.id === id);
}

export function applyEffectOccasion(node: DesignerEffectNode, occasion: DesignerOccasion): DesignerEffectNode {
  const options = effectsForOccasion(occasion);
  const keep = options.find((option) => option.id === node.effect);
  const next = keep ?? options.find((option) => option.ready) ?? options[0];
  return { ...node, occasion, effect: next?.id ?? node.effect };
}

export function nodeSummary(node: DesignerNode): string {
  if (node.kind === "text") return node.text.trim() || "Text";
  if (node.kind === "emoji") return node.emoji || "Choose";
  if (node.kind === "animation") {
    return node.animationKind === "dynamic" ? "Scroll" : "Static";
  }
  if (node.kind === "color") {
    if (node.colorMode === "rgb") return "RGB / Full Color";
    const label = DESIGNER_COLORS.find((color) => color.id === node.colorId)?.label ?? "Amber";
    return `Mono · ${label}`;
  }
  if (node.kind === "api") return node.connected ? "Connected" : "Not connected";
  return DESIGNER_OCCASIONS.find((item) => item.id === node.occasion)?.label ?? "Effect";
}

export function filterEmojiGroups(query: string, groups = DESIGNER_EMOJI_GROUPS): DesignerEmojiGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.glyph.includes(needle) ||
          item.keywords.some((keyword) => keyword.includes(needle)) ||
          group.label.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export type DesignerDisplaySize = { width: number; height: number };

export function resolveDesignerSize(size?: DesignerDisplaySize | null): DesignerDisplaySize {
  const width = size && Number.isFinite(size.width) && size.width > 0 ? Math.round(size.width) : DESIGNER_WIDTH;
  const height = size && Number.isFinite(size.height) && size.height > 0 ? Math.round(size.height) : DESIGNER_HEIGHT;
  return { width, height };
}

export const DESIGNER_FLOW_KIND = "ticker-flow";

export type DesignerFlowRecord = {
  kind: typeof DESIGNER_FLOW_KIND;
  tickerId: string;
  nodes: DesignerNode[];
};

export type DesignerStoredDocument = CompositionDocument & {
  designer?: DesignerFlowRecord;
};

function overlayLayers(
  rows: { id: string; y: number; speed: number; text: string }[],
  color: string,
  fontPx: number,
): Layer[] {
  return rows.map((row) => ({
    id: row.id,
    type: "text" as const,
    zIndex: 5,
    y: row.y,
    props: {
      text: glyphSafeDesignerMessage(row.text),
      color,
      fontPx,
      scrollPxPerSec: row.speed,
    },
  }));
}

function glyphBand(glyph: string, gap = "    "): string {
  return Array.from({ length: 8 }, () => glyph).join(gap);
}

export function effectLayers(effect: DesignerEffect, color: string, height = DESIGNER_HEIGHT): Layer[] {
  const scaleY = (y: number) => Math.max(0, Math.round((y / DESIGNER_HEIGHT) * height));
  if (effect === "none") return [];
  if (effect === "snow") {
    return overlayLayers(
      [
        { id: "fx-snow-1", y: scaleY(10), speed: 26, text: "*    *      *   *     *    *     *   *" },
        { id: "fx-snow-2", y: scaleY(28), speed: 42, text: "  *     *   *      *    *   *      * " },
        { id: "fx-snow-3", y: scaleY(50), speed: 18, text: "*   *     *    *      *    *    *    " },
      ],
      color,
      Math.max(8, Math.round((12 / DESIGNER_HEIGHT) * height)),
    );
  }
  const bands: Record<DesignerEffectId, { y: number; speed: number }[]> = {
    snow: [],
    santa: [
      { y: 8, speed: 28 },
      { y: 50, speed: 18 },
    ],
    diyas: [
      { y: 8, speed: 22 },
      { y: 50, speed: 34 },
    ],
    sparkles: [
      { y: 8, speed: 30 },
      { y: 50, speed: 20 },
    ],
    pumpkin: [
      { y: 8, speed: 24 },
      { y: 50, speed: 16 },
    ],
    ghost: [
      { y: 8, speed: 20 },
      { y: 50, speed: 32 },
    ],
    fireworks: [
      { y: 8, speed: 26 },
      { y: 50, speed: 18 },
    ],
    confetti: [
      { y: 8, speed: 36 },
      { y: 50, speed: 22 },
    ],
  };
  const glyphs: Record<DesignerEffectId, string> = {
    snow: "*",
    santa: "🎅",
    diyas: "🪔",
    sparkles: "✨",
    pumpkin: "🎃",
    ghost: "👻",
    fireworks: "🎆",
    confetti: "🎊",
  };
  const glyph = glyphs[effect];
  return overlayLayers(
    bands[effect].map((row, index) => ({
      id: `fx-${effect}-${index + 1}`,
      y: scaleY(row.y),
      speed: row.speed,
      text: glyphBand(glyph),
    })),
    color,
    Math.max(8, Math.round((14 / DESIGNER_HEIGHT) * height)),
  );
}

export function overlayPaintColor(playback: DesignerPlayback, messageColor: string): string {
  if (playback.colorMode === "mono" || !playback.message) return messageColor;
  if (playback.effect === "snow") return "#FFFFFF";
  if (playback.effect === "sparkles" || playback.effect === "diyas") return "#FFB000";
  return messageColor;
}

export function buildDesignerDocument(
  playback: DesignerPlayback,
  size?: DesignerDisplaySize | null,
): CompositionDocument {
  const { width, height } = resolveDesignerSize(size);
  const message = glyphSafeDesignerMessage(playback.message, height);
  const scrolling = designerScrolling(playback);
  const color = designerTextColor(playback.colorId);
  const fontPx = Math.max(10, height - 8);
  const layers: Layer[] = [{ id: "bg", type: "fill", zIndex: 0, props: { color: "#000000" } }];
  if (message) {
    layers.push({
      id: "message",
      type: "text",
      zIndex: 10,
      x: scrolling ? undefined : 12,
      y: scrolling ? undefined : Math.round(height / 2),
      props: {
        text: message,
        color,
        fontPx,
        scrollPxPerSec: scrolling ? Math.max(40, Math.round(width / 8)) : 0,
      },
    });
  }
  if (playback.effect !== "none" && effectOption(playback.effect)?.ready) {
    layers.push(...effectLayers(playback.effect, overlayPaintColor(playback, color), height));
  }
  return {
    schemaVersion: "1",
    profile: {
      width,
      height,
      colorMode: designerProfileColorMode(playback.colorMode),
    },
    layers,
  };
}

export function persistDesignerDocument(input: {
  tickerId: string;
  nodes: DesignerNode[];
  width: number;
  height: number;
}): DesignerStoredDocument {
  const playback = resolveFlowPlayback(input.nodes);
  const document = buildDesignerDocument(playback, { width: input.width, height: input.height });
  return {
    ...document,
    designer: {
      kind: DESIGNER_FLOW_KIND,
      tickerId: input.tickerId,
      nodes: input.nodes,
    },
  };
}

export function readDesignerNodes(document: unknown, tickerId: string): DesignerNode[] | null {
  if (!tickerId || !document || typeof document !== "object") return null;
  const designer = (document as DesignerStoredDocument).designer;
  if (!designer || designer.kind !== DESIGNER_FLOW_KIND) return null;
  if (designer.tickerId !== tickerId) return null;
  if (!Array.isArray(designer.nodes)) return null;
  return designer.nodes;
}

export function glyphSafeDesignerMessage(message: string, height = DESIGNER_HEIGHT): string {
  const probe = prepareDesignerMessage(message);
  if (typeof document === "undefined") return probe;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return probe;
  ctx.font = `bold ${Math.max(10, height - 8)}px ${LED_TEXT_FONT_STACK}`;
  return replaceUnsupportedGraphemes(probe, (grapheme) => canvasGlyphSupported(ctx, grapheme));
}

export { canvasGlyphSupported, replaceUnsupportedGraphemes };
