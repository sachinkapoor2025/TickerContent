import { createDemoDocument, type CompositionDocument } from "@ticker-cms/composition";
import { describe, expect, it } from "vitest";
import {
  addImageLayer,
  addLottieLayer,
  addTextLayer,
  blankComposition,
  editorSaveBody,
  headDocumentFromContent,
  setLayerGeometry,
  setLayerVisible,
  updateLayer,
} from "./documentOps.js";

const profile = { width: 620, height: 64, colorMode: "full" as const };

function emptyDoc(): CompositionDocument {
  return { schemaVersion: "1", profile, layers: [] };
}

describe("editor layer operations", () => {
  it("adds a text layer", () => {
    const doc = addTextLayer(emptyDoc(), "txt_1");
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0]).toMatchObject({
      id: "txt_1",
      type: "text",
      x: 0,
      y: 0,
      visible: true,
      props: { text: "New text", scrollPxPerSec: 0 },
    });
  });

  it("adds an image layer with assetId only", () => {
    const doc = addImageLayer(emptyDoc(), "ast_image", "img_1");
    expect(doc.layers[0]).toMatchObject({ id: "img_1", type: "image", assetId: "ast_image" });
    expect(JSON.stringify(doc)).not.toContain("data:");
  });

  it("adds a Lottie layer with assetId only", () => {
    const doc = addLottieLayer(emptyDoc(), "ast_lottie", "lot_1");
    expect(doc.layers[0]).toMatchObject({
      id: "lot_1",
      type: "lottie",
      assetId: "ast_lottie",
      loop: true,
    });
  });

  it("edits x/y/width/height against the display profile", () => {
    let doc = addImageLayer(emptyDoc(), "ast_image", "img_1");
    doc = setLayerGeometry(doc, "img_1", { x: 10.4, y: 2.2, width: 40, height: 20 });
    expect(doc.layers[0]).toMatchObject({ x: 10, y: 2, width: 40, height: 20 });
    doc = setLayerGeometry(doc, "img_1", { x: -8, width: 9999 });
    expect(doc.layers[0].x).toBe(0);
    expect(doc.layers[0].width).toBe(620);
  });

  it("edits zIndex without clearing x/y/width/height", () => {
    let doc = addImageLayer(emptyDoc(), "ast_image", "img_1");
    doc = setLayerGeometry(doc, "img_1", { x: 8, y: 6, width: 40, height: 20 });
    doc = setLayerGeometry(doc, "img_1", { zIndex: 42 });
    expect(doc.layers[0]).toMatchObject({ x: 8, y: 6, width: 40, height: 20, zIndex: 42 });
  });

  it("toggles visible", () => {
    let doc = addTextLayer(emptyDoc(), "txt_1");
    doc = setLayerVisible(doc, "txt_1", false);
    expect(doc.layers[0].visible).toBe(false);
  });

  it("preserves scrolling text when editing other fields", () => {
    let doc = createDemoDocument(profile, "LED scroll");
    const before = doc.layers.find((layer) => layer.type === "text");
    expect(before && before.type === "text" ? before.props.scrollPxPerSec : 0).toBeGreaterThan(0);
    const textId = before!.id;
    doc = updateLayer(doc, textId, (layer) =>
      layer.type === "text" ? { ...layer, props: { ...layer.props, color: "#ffffff" } } : layer,
    );
    const after = doc.layers.find((layer) => layer.id === textId);
    expect(after && after.type === "text" ? after.props.scrollPxPerSec : 0).toBe(
      before && before.type === "text" ? before.props.scrollPxPerSec : -1,
    );
    expect(after && after.type === "text" ? after.props.text : "").toBe("LED scroll");
  });
});

describe("editor save and load", () => {
  it("creates a blank composition without demo text", () => {
    const doc = blankComposition(profile);
    expect(doc.layers).toEqual([]);
    expect(JSON.stringify(doc)).not.toMatch(/your message here/i);
  });
  it("save payload is the CompositionDocument with assetId references", () => {
    let doc = addTextLayer(emptyDoc(), "txt_1");
    doc = addImageLayer(doc, "ast_image", "img_1");
    doc = addLottieLayer(doc, "ast_lottie", "lot_1");
    const body = editorSaveBody("Lobby board", doc);
    expect(body.title).toBe("Lobby board");
    expect(body.document.layers.map((layer) => layer.type)).toEqual(["text", "image", "lottie"]);
    expect(body.document.layers.find((layer) => layer.type === "image")).toMatchObject({ assetId: "ast_image" });
    expect(JSON.stringify(body)).not.toMatch(/"buffer"|ArrayBuffer|data:image/);
  });

  it("loads the saved head composition instead of a demo document", () => {
    const saved = addLottieLayer(addImageLayer(addTextLayer(emptyDoc(), "txt_1"), "ast_image", "img_1"), "ast_lottie", "lot_1");
    const loaded = headDocumentFromContent({ document: saved });
    expect(loaded).toEqual(saved);
    expect(headDocumentFromContent({ document: createDemoDocument(profile, "ignored") })?.layers[1]).toMatchObject({
      type: "text",
      props: { text: "ignored" },
    });
    expect(headDocumentFromContent({})).toBeNull();
  });
});
