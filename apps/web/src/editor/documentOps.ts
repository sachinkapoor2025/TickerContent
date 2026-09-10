import {
  layerZIndex,
  snapToLed,
  type CompositionDocument,
  type DisplayProfile,
  type FillLayer,
  type ImageLayer,
  type Layer,
  type LottieLayer,
  type TextLayer,
} from "@ticker-cms/composition";

export function newLayerId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nextZIndex(layers: Layer[]): number {
  if (layers.length === 0) return 0;
  return Math.max(...layers.map(layerZIndex)) + 10;
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, snapToLed(value)));
}

export function clampPlacement(
  profile: DisplayProfile,
  patch: { x?: number; y?: number; width?: number; height?: number },
): { x?: number; y?: number; width?: number; height?: number } {
  const maxW = Math.max(1, profile.width);
  const maxH = Math.max(1, profile.height);
  return {
    x: patch.x == null ? undefined : clampInt(patch.x, 0, maxW),
    y: patch.y == null ? undefined : clampInt(patch.y, 0, maxH),
    width: patch.width == null ? undefined : clampInt(patch.width, 1, maxW),
    height: patch.height == null ? undefined : clampInt(patch.height, 1, maxH),
  };
}

export function applyDisplayProfile(doc: CompositionDocument, profile: DisplayProfile): CompositionDocument {
  return { ...doc, profile };
}

export function updateLayer(
  doc: CompositionDocument,
  id: string,
  updater: (layer: Layer) => Layer,
): CompositionDocument {
  return { ...doc, layers: doc.layers.map((layer) => (layer.id === id ? updater(layer) : layer)) };
}

export function removeLayer(doc: CompositionDocument, id: string): CompositionDocument {
  return { ...doc, layers: doc.layers.filter((layer) => layer.id !== id) };
}

export function addFillLayer(doc: CompositionDocument, id = newLayerId("fill")): CompositionDocument {
  if (doc.layers.some((layer) => layer.type === "fill")) return doc;
  const layer: FillLayer = {
    id,
    type: "fill",
    zIndex: 0,
    visible: true,
    props: { color: "#050705" },
  };
  return { ...doc, layers: [layer, ...doc.layers] };
}

export function addTextLayer(doc: CompositionDocument, id = newLayerId("txt")): CompositionDocument {
  const layer: TextLayer = {
    id,
    type: "text",
    x: 0,
    y: 0,
    width: doc.profile.width,
    height: doc.profile.height,
    zIndex: nextZIndex(doc.layers),
    visible: true,
    props: {
      text: "New text",
      color: "#7CFF6B",
      fontPx: Math.max(10, doc.profile.height - 8),
      scrollPxPerSec: 0,
    },
  };
  return { ...doc, layers: [...doc.layers, layer] };
}

export function addImageLayer(doc: CompositionDocument, assetId: string, id = newLayerId("img")): CompositionDocument {
  const size = Math.min(48, doc.profile.height, doc.profile.width);
  const layer: ImageLayer = {
    id,
    type: "image",
    assetId,
    x: 4,
    y: 4,
    width: size,
    height: size,
    zIndex: nextZIndex(doc.layers),
    visible: true,
  };
  return { ...doc, layers: [...doc.layers, layer] };
}

export function addLottieLayer(doc: CompositionDocument, assetId: string, id = newLayerId("lot")): CompositionDocument {
  const size = Math.min(48, doc.profile.height, doc.profile.width);
  const layer: LottieLayer = {
    id,
    type: "lottie",
    assetId,
    x: Math.max(0, doc.profile.width - size - 4),
    y: 4,
    width: size,
    height: size,
    zIndex: nextZIndex(doc.layers),
    visible: true,
    loop: true,
  };
  return { ...doc, layers: [...doc.layers, layer] };
}

export function setLayerVisible(doc: CompositionDocument, id: string, visible: boolean): CompositionDocument {
  return updateLayer(doc, id, (layer) => ({ ...layer, visible }));
}

export function setLayerGeometry(
  doc: CompositionDocument,
  id: string,
  patch: { x?: number; y?: number; width?: number; height?: number; zIndex?: number },
): CompositionDocument {
  const clamped = clampPlacement(doc.profile, patch);
  return updateLayer(doc, id, (layer) => {
    const next = { ...layer };
    if (clamped.x != null) next.x = clamped.x;
    if (clamped.y != null) next.y = clamped.y;
    if (clamped.width != null) next.width = clamped.width;
    if (clamped.height != null) next.height = clamped.height;
    if (patch.zIndex != null) next.zIndex = snapToLed(patch.zIndex);
    return next;
  });
}

export function moveLayer(doc: CompositionDocument, id: string, direction: "up" | "down"): CompositionDocument {
  const ordered = [...doc.layers].sort((a, b) => layerZIndex(a) - layerZIndex(b));
  const index = ordered.findIndex((layer) => layer.id === id);
  if (index < 0) return doc;
  const swap = direction === "up" ? index + 1 : index - 1;
  if (swap < 0 || swap >= ordered.length) return doc;
  const current = ordered[index];
  const neighbor = ordered[swap];
  if (!current || !neighbor) return doc;
  const currentZ = layerZIndex(current);
  const neighborZ = layerZIndex(neighbor);
  if (currentZ === neighborZ) {
    return updateLayer(doc, id, (layer) => ({
      ...layer,
      zIndex: currentZ + (direction === "up" ? 1 : -1),
    }));
  }
  return {
    ...doc,
    layers: doc.layers.map((layer) => {
      if (layer.id === current.id) return { ...layer, zIndex: neighborZ };
      if (layer.id === neighbor.id) return { ...layer, zIndex: currentZ };
      return layer;
    }),
  };
}

export function referencedMediaAssetIds(doc: CompositionDocument): { images: string[]; lottie: string[] } {
  const images: string[] = [];
  const lottie: string[] = [];
  for (const layer of doc.layers) {
    if (layer.type === "image" && layer.assetId) images.push(layer.assetId);
    if (layer.type === "lottie" && layer.assetId) lottie.push(layer.assetId);
  }
  return { images: [...new Set(images)], lottie: [...new Set(lottie)] };
}

export function editorSaveBody(title: string, doc: CompositionDocument): { title: string; document: CompositionDocument } {
  return { title, document: doc };
}

export function headDocumentFromContent(payload: { document?: unknown }): CompositionDocument | null {
  const value = payload.document;
  if (!value || typeof value !== "object") return null;
  const doc = value as CompositionDocument;
  if (doc.schemaVersion !== "1" || !doc.profile || !Array.isArray(doc.layers)) return null;
  return doc;
}

export function layersByStack(layers: Layer[]): Layer[] {
  return [...layers].sort((a, b) => layerZIndex(b) - layerZIndex(a));
}

export function layerTypeLabel(layer: Layer): string {
  if (layer.type === "fill") return "Background";
  if (layer.type === "text") return "Text";
  if (layer.type === "image") return "Image";
  return "Lottie";
}

export function layerLabel(layer: Layer, assetNames: Record<string, string> = {}): string {
  if (layer.type === "text") return layer.props.text.trim() || "Text";
  if (layer.type === "fill") return "Background";
  if (layer.type === "image" || layer.type === "lottie") {
    const named = assetNames[layer.assetId]?.trim();
    if (named) return named;
    return layerTypeLabel(layer);
  }
  return layerTypeLabel(layer);
}

export function blankComposition(profile: DisplayProfile): CompositionDocument {
  return { schemaVersion: "1", profile, layers: [] };
}
