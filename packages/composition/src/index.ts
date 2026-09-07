export type ColorMode = "full" | "mono" | "rg";

export type DisplayProfile = {
  width: number;
  height: number;
  colorMode: ColorMode;
};

export type Layer =
  | {
      id: string;
      type: "fill";
      z: number;
      props: { color: string };
    }
  | {
      id: string;
      type: "text";
      z: number;
      props: {
        text: string;
        color: string;
        fontPx?: number;
        scrollPxPerSec?: number;
      };
    };

export type CompositionDocument = {
  schemaVersion: "1";
  profile: DisplayProfile;
  layers: Layer[];
};

export function snapToLed(value: number): number {
  return Math.round(value);
}

export function createDemoDocument(profile: DisplayProfile, headline: string): CompositionDocument {
  return {
    schemaVersion: "1",
    profile,
    layers: [
      { id: "bg", type: "fill", z: 0, props: { color: "#050705" } },
      {
        id: "headline",
        type: "text",
        z: 10,
        props: {
          text: headline,
          color: "#7CFF6B",
          fontPx: Math.max(10, profile.height - 8),
          scrollPxPerSec: Math.max(40, Math.round(profile.width / 8)),
        },
      },
    ],
  };
}

export function renderFrame(
  doc: CompositionDocument,
  ctx: CanvasRenderingContext2D,
  timeMs: number,
): void {
  const { width, height } = doc.profile;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  const layers = [...doc.layers].sort((a, b) => a.z - b.z);
  for (const layer of layers) {
    if (layer.type === "fill") {
      ctx.fillStyle = layer.props.color;
      ctx.fillRect(0, 0, width, height);
    }
    if (layer.type === "text") {
      const fontPx = layer.props.fontPx ?? Math.max(10, height - 8);
      ctx.font = `bold ${fontPx}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.fillStyle = layer.props.color;
      ctx.textBaseline = "middle";
      const text = layer.props.text;
      const measured = ctx.measureText(text).width;
      const speed = layer.props.scrollPxPerSec ?? 80;
      const loop = measured + width;
      const x = width - ((timeMs / 1000) * speed) % loop;
      ctx.fillText(text, snapToLed(x), snapToLed(height / 2));
    }
  }
}
