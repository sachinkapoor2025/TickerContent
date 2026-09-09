export const COLOR_MODES = ["full", "mono", "rg"] as const;

export type ColorMode = (typeof COLOR_MODES)[number];

export type DisplayProfile = {
  width: number;
  height: number;
  colorMode: ColorMode;
};

export const LAYER_TYPES = ["fill", "text", "image", "lottie"] as const;

export type LayerType = (typeof LAYER_TYPES)[number];

/**
 * Shared geometry/stacking for visual layers.
 * `z` is the original v1 field; prefer `zIndex`. Readers should use `layerZIndex()`.
 */
export type LayerPlacement = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  /** Original schema v1 stacking field. Treated as zIndex when zIndex is absent. */
  z?: number;
  visible?: boolean;
};

export type FillLayer = LayerPlacement & {
  id: string;
  type: "fill";
  props: { color: string };
};

export type TextLayer = LayerPlacement & {
  id: string;
  type: "text";
  props: {
    text: string;
    color: string;
    fontPx?: number;
    scrollPxPerSec?: number;
  };
};

export type ImageLayer = LayerPlacement & {
  id: string;
  type: "image";
  assetId: string;
};

export type LottieLayer = LayerPlacement & {
  id: string;
  type: "lottie";
  assetId: string;
  loop?: boolean;
};

export type Layer = FillLayer | TextLayer | ImageLayer | LottieLayer;

export type CompositionDocument = {
  schemaVersion: "1";
  profile: DisplayProfile;
  layers: Layer[];
};

export function snapToLed(value: number): number {
  return Math.round(value);
}

export function layerZIndex(layer: LayerPlacement): number {
  return layer.zIndex ?? layer.z ?? 0;
}

export function layerVisible(layer: LayerPlacement): boolean {
  return layer.visible !== false;
}

export type LottieRenderRequest = {
  assetId: string;
  layer: LottieLayer;
  timeMs: number;
  width: number;
  height: number;
};

/**
 * Caller-supplied media for one frame. The renderer never fetches, queries a DB, or talks to S3.
 */
export type RenderResources = {
  images?: Record<string, CanvasImageSource>;
  renderLottie?: (request: LottieRenderRequest) => CanvasImageSource | null | undefined;
};

export function createDemoDocument(profile: DisplayProfile, headline: string): CompositionDocument {
  const fontPx = Math.max(10, profile.height - 8);
  return {
    schemaVersion: "1",
    profile,
    layers: [
      { id: "bg", type: "fill", z: 0, zIndex: 0, props: { color: "#050705" } },
      {
        id: "headline",
        type: "text",
        z: 10,
        zIndex: 10,
        props: {
          text: headline,
          color: "#7CFF6B",
          fontPx,
          scrollPxPerSec: Math.max(40, Math.round(profile.width / 8)),
        },
      },
    ],
  };
}

function placedRect(
  layer: LayerPlacement,
  profile: DisplayProfile,
): { x: number; y: number; width: number; height: number } {
  return {
    x: snapToLed(layer.x ?? 0),
    y: snapToLed(layer.y ?? 0),
    width: snapToLed(layer.width ?? profile.width),
    height: snapToLed(layer.height ?? profile.height),
  };
}

export function renderFrame(
  doc: CompositionDocument,
  ctx: CanvasRenderingContext2D,
  timeMs: number,
  resources: RenderResources = {},
): void {
  const { width, height } = doc.profile;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  const layers = [...doc.layers].sort((a, b) => layerZIndex(a) - layerZIndex(b));
  for (const layer of layers) {
    if (!layerVisible(layer)) continue;
    if (layer.type === "fill") {
      ctx.fillStyle = layer.props.color;
      if (layer.x == null && layer.y == null && layer.width == null && layer.height == null) {
        ctx.fillRect(0, 0, width, height);
      } else {
        const rect = placedRect(layer, doc.profile);
        if (rect.width > 0 && rect.height > 0) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
    if (layer.type === "text") {
      const fontPx = layer.props.fontPx ?? Math.max(10, layer.height ?? height - 8);
      ctx.font = `bold ${fontPx}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.fillStyle = layer.props.color;
      ctx.textBaseline = "middle";
      const text = layer.props.text;
      const measured = ctx.measureText(text).width;
      const speed = layer.props.scrollPxPerSec ?? 80;
      const travel = measured + (layer.width ?? width);
      const offset = travel === 0 ? 0 : ((timeMs / 1000) * speed) % travel;
      const x =
        layer.x == null ? width - offset : layer.x - (speed === 0 ? 0 : offset);
      const y =
        layer.y == null
          ? height / 2
          : layer.height != null
            ? layer.y + layer.height / 2
            : layer.y;
      ctx.fillText(text, snapToLed(x), snapToLed(y));
    }
    if (layer.type === "image") {
      const image = resources.images?.[layer.assetId];
      if (!image) continue;
      const w = snapToLed(layer.width ?? 0);
      const h = snapToLed(layer.height ?? 0);
      if (w <= 0 || h <= 0) continue;
      ctx.drawImage(image, snapToLed(layer.x ?? 0), snapToLed(layer.y ?? 0), w, h);
    }
    if (layer.type === "lottie") {
      if (!resources.renderLottie) continue;
      const w = snapToLed(layer.width ?? 0);
      const h = snapToLed(layer.height ?? 0);
      if (w <= 0 || h <= 0) continue;
      const frame = resources.renderLottie({
        assetId: layer.assetId,
        layer,
        timeMs,
        width: w,
        height: h,
      });
      if (!frame) continue;
      ctx.drawImage(frame, snapToLed(layer.x ?? 0), snapToLed(layer.y ?? 0), w, h);
    }
  }
}
