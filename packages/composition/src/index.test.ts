import { describe, expect, it } from "vitest";
import {
  createDemoDocument,
  layerZIndex,
  renderFrame,
  snapToLed,
  type CompositionDocument,
  type ImageLayer,
  type Layer,
  type LottieLayer,
  type LottieRenderRequest,
} from "./index.js";

const profile = { width: 993, height: 32, colorMode: "full" as const };

function mockCtx() {
  const ops: string[] = [];
  const fills: { color: unknown; x: number; y: number; w: number; h: number }[] = [];
  const texts: { text: string; x: number; y: number }[] = [];
  const images: { source: unknown; x: number; y: number; w: number; h: number }[] = [];
  const ctx = {
    imageSmoothingEnabled: true,
    fillStyle: "",
    font: "",
    textBaseline: "alphabetic",
    clearRect: () => {
      ops.push("clear");
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      ops.push("fill");
      fills.push({ color: ctx.fillStyle, x, y, w, h });
    },
    fillText: (text: string, x: number, y: number) => {
      ops.push("text");
      texts.push({ text, x, y });
    },
    drawImage: (source: unknown, x: number, y: number, w: number, h: number) => {
      ops.push("image");
      images.push({ source, x, y, w, h });
    },
    measureText: () => ({ width: 40 }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops, fills, texts, images, raw: ctx };
}

describe("snapToLed", () => {
  it("rounds to integer LED columns", () => {
    expect(snapToLed(10.4)).toBe(10);
    expect(snapToLed(10.6)).toBe(11);
  });
});

describe("createDemoDocument", () => {
  it("uses the device profile", () => {
    const doc = createDemoDocument(profile, "Hello");
    expect(doc.schemaVersion).toBe("1");
    expect(doc.profile.width).toBe(993);
    expect(doc.layers[0]?.type).toBe("fill");
  });

  it("still represents a fill layer with color", () => {
    const doc = createDemoDocument(profile, "Hello");
    const fill = doc.layers.find((layer) => layer.type === "fill");
    expect(fill?.type).toBe("fill");
    if (fill?.type === "fill") {
      expect(fill.props.color).toBe("#050705");
    }
  });

  it("still represents scrolling text", () => {
    const doc = createDemoDocument(profile, "Hello");
    const text = doc.layers.find((layer) => layer.type === "text");
    expect(text?.type).toBe("text");
    if (text?.type === "text") {
      expect(text.props.text).toBe("Hello");
      expect(text.props.scrollPxPerSec).toBeGreaterThan(0);
    }
  });
});

describe("image and lottie layers", () => {
  it("represents an image layer with assetId and geometry", () => {
    const layer: ImageLayer = {
      id: "logo",
      type: "image",
      assetId: "asset_logo",
      x: 8,
      y: 4,
      width: 32,
      height: 24,
      zIndex: 5,
      visible: true,
    };
    expect(layer.assetId).toBe("asset_logo");
    expect(layer).toMatchObject({ x: 8, y: 4, width: 32, height: 24, zIndex: 5 });
  });

  it("represents a lottie layer with assetId, geometry, and loop", () => {
    const layer: LottieLayer = {
      id: "diya",
      type: "lottie",
      assetId: "asset_platform_diya",
      x: 0,
      y: 0,
      width: 64,
      height: 32,
      zIndex: 20,
      visible: true,
      loop: true,
    };
    expect(layer.assetId).toBe("asset_platform_diya");
    expect(layer.loop).toBe(true);
  });

  it("allows mixed layers with distinct zIndex values", () => {
    const layers: Layer[] = [
      { id: "bg", type: "fill", zIndex: 0, props: { color: "#000000" } },
      {
        id: "logo",
        type: "image",
        assetId: "asset_logo",
        x: 0,
        y: 0,
        width: 16,
        height: 16,
        zIndex: 2,
      },
      {
        id: "anim",
        type: "lottie",
        assetId: "asset_lottie",
        x: 20,
        y: 0,
        width: 32,
        height: 32,
        zIndex: 3,
        loop: false,
      },
      {
        id: "headline",
        type: "text",
        zIndex: 10,
        props: { text: "Hello", color: "#fff", scrollPxPerSec: 40 },
      },
    ];
    const ordered = [...layers].sort((a, b) => layerZIndex(a) - layerZIndex(b)).map((layer) => layer.id);
    expect(ordered).toEqual(["bg", "logo", "anim", "headline"]);
  });
});

describe("renderFrame", () => {
  it("draws existing fill and text documents", () => {
    const doc = createDemoDocument(profile, "Hello");
    const { ctx, ops, fills, texts, raw } = mockCtx();
    renderFrame(doc, ctx, 0);
    expect(ops).toEqual(["clear", "fill", "text"]);
    expect(raw.imageSmoothingEnabled).toBe(false);
    expect(fills[0]).toMatchObject({ x: 0, y: 0, w: 993, h: 32, color: "#050705" });
    expect(texts[0]?.text).toBe("Hello");
  });

  it("scrolls legacy text from the right of the matrix", () => {
    const doc = createDemoDocument(profile, "Hello");
    const speed = Math.max(40, Math.round(profile.width / 8));
    const { ctx, texts } = mockCtx();
    renderFrame(doc, ctx, 1000);
    const travel = 40 + profile.width;
    const expectedX = snapToLed(profile.width - (speed % travel));
    expect(texts[0]?.x).toBe(expectedX);
    expect(texts[0]?.y).toBe(snapToLed(profile.height / 2));
  });

  it("renders text at explicit x/y when not scrolling", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        {
          id: "label",
          type: "text",
          x: 12.4,
          y: 8.6,
          props: { text: "Hi", color: "#fff", scrollPxPerSec: 0 },
        },
      ],
    };
    const { ctx, texts } = mockCtx();
    renderFrame(doc, ctx, 5000);
    expect(texts[0]).toEqual({ text: "Hi", x: snapToLed(12.4), y: snapToLed(8.6) });
  });

  it("draws layers in zIndex order", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        { id: "top", type: "fill", zIndex: 2, props: { color: "#fff" } },
        { id: "bottom", type: "fill", z: 0, props: { color: "#000" } },
      ],
    };
    const { ctx, fills } = mockCtx();
    renderFrame(doc, ctx, 0);
    expect(fills.map((f) => f.color)).toEqual(["#000", "#fff"]);
  });

  it("skips layers with visible false", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        { id: "bg", type: "fill", zIndex: 0, props: { color: "#111" } },
        {
          id: "hidden",
          type: "text",
          visible: false,
          props: { text: "secret", color: "#fff", scrollPxPerSec: 0 },
        },
      ],
    };
    const { ctx, ops } = mockCtx();
    renderFrame(doc, ctx, 0);
    expect(ops).toEqual(["clear", "fill"]);
  });

  it("draws a supplied image source without fetching", () => {
    const source = { kind: "image-source" };
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        {
          id: "logo",
          type: "image",
          assetId: "asset_logo",
          x: 4.2,
          y: 2.8,
          width: 16.4,
          height: 8.1,
          zIndex: 1,
        },
      ],
    };
    const { ctx, images } = mockCtx();
    renderFrame(doc, ctx, 0, { images: { asset_logo: source as unknown as CanvasImageSource } });
    expect(images).toEqual([{ source, x: 4, y: 3, w: 16, h: 8 }]);
  });

  it("skips missing image assets without crashing", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        { id: "bg", type: "fill", z: 0, props: { color: "#111" } },
        {
          id: "logo",
          type: "image",
          assetId: "missing",
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          zIndex: 1,
        },
      ],
    };
    const { ctx, ops } = mockCtx();
    renderFrame(doc, ctx, 250);
    expect(ops).toEqual(["clear", "fill"]);
  });

  it("invokes the supplied Lottie renderer and draws its frame", () => {
    const frame = { kind: "lottie-frame" };
    const requests: LottieRenderRequest[] = [];
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        {
          id: "anim",
          type: "lottie",
          assetId: "asset_lottie",
          x: 10,
          y: 2,
          width: 32,
          height: 16,
          zIndex: 1,
          loop: true,
        },
      ],
    };
    const { ctx, images } = mockCtx();
    renderFrame(doc, ctx, 120, {
      renderLottie: (request) => {
        requests.push(request);
        return frame as unknown as CanvasImageSource;
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ assetId: "asset_lottie", timeMs: 120, width: 32, height: 16 });
    expect(images).toEqual([{ source: frame, x: 10, y: 2, w: 32, h: 16 }]);
  });

  it("skips lottie layers when no renderer is supplied", () => {
    const doc: CompositionDocument = {
      schemaVersion: "1",
      profile,
      layers: [
        { id: "bg", type: "fill", z: 0, props: { color: "#111" } },
        {
          id: "anim",
          type: "lottie",
          assetId: "asset_lottie",
          x: 16,
          y: 0,
          width: 32,
          height: 32,
          zIndex: 2,
          loop: true,
        },
      ],
    };
    const { ctx, ops } = mockCtx();
    renderFrame(doc, ctx, 250);
    expect(ops).toEqual(["clear", "fill"]);
  });

  it("honors legacy z when zIndex is absent", () => {
    const lower: Layer = { id: "a", type: "fill", z: 1, props: { color: "#000" } };
    const higher: Layer = { id: "b", type: "fill", zIndex: 5, props: { color: "#fff" } };
    expect(layerZIndex(lower)).toBe(1);
    expect(layerZIndex(higher)).toBe(5);
  });
});
