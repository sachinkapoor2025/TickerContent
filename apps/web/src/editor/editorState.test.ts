import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "../session.js";
import {
  addImageLayer,
  addLottieLayer,
  addTextLayer,
  blankComposition,
  editorSaveBody,
  headDocumentFromContent,
  layerLabel,
  layerTypeLabel,
  setLayerGeometry,
  setLayerVisible,
  updateLayer,
} from "./documentOps.js";
import {
  EDITOR_EMPTY_MESSAGE,
  EDITOR_ERROR_MESSAGE,
  EDITOR_LOADING_MESSAGE,
  EDITOR_NO_IMAGE_ASSETS,
  EDITOR_NO_LOTTIE_ASSETS,
  EDITOR_SAVE_ERROR,
  EDITOR_SAVE_SUCCESS,
  EDITOR_SAVED_LABEL,
  EDITOR_SAVING_LABEL,
  EDITOR_UNSAVED_LABEL,
  EDITOR_PUBLISH_SUCCESS,
  assetsByKind,
  canSaveDocument,
  documentForEditor,
  editorDirty,
  editorPageState,
  editorPublishMessage,
  editorSaveStatus,
  editorSnapshot,
  editorSubmitLabel,
  hasPublishedVersion,
  parseEditorInteger,
  publishedVersionUntouched,
  resolveEditorProfile,
  saveDraftBody,
} from "./editorState.js";

const lobbyProfile = { width: 128, height: 16, colorMode: "full" as const };
const concourseTicker = { id: "tkr_2", name: "Concourse", width: 200, height: 40, colorMode: "mono" as const };

function emptyDoc() {
  return blankComposition(lobbyProfile);
}

describe("editor loading", () => {
  it("loads a blank composition when no draft document exists", () => {
    const doc = documentForEditor({ payload: {}, profile: lobbyProfile });
    expect(doc).toEqual({ schemaVersion: "1", profile: lobbyProfile, layers: [] });
    expect(JSON.stringify(doc)).not.toMatch(/your message here/i);
    expect(doc?.layers).toHaveLength(0);
  });

  it("loads an existing draft document", () => {
    const saved = addTextLayer(emptyDoc(), "txt_1");
    const loaded = documentForEditor({ payload: { document: saved }, profile: null });
    expect(loaded).toEqual(saved);
    expect(headDocumentFromContent({ document: saved })).toEqual(saved);
  });

  it("shows loading and error states without fake layers", () => {
    expect(editorPageState({ loading: true, error: null, ready: false })).toEqual({
      kind: "loading",
      message: EDITOR_LOADING_MESSAGE,
    });
    const failed = editorPageState({ loading: false, error: null, ready: false });
    expect(failed).toEqual({ kind: "error", message: EDITOR_ERROR_MESSAGE });
    expect(JSON.stringify(failed)).not.toMatch(/your message here|demo/i);
  });
});

describe("editor profile", () => {
  it("uses the selected ticker profile instead of hardcoded canvas sizes", () => {
    const profile = resolveEditorProfile({ ticker: concourseTicker, document: blankComposition(lobbyProfile) });
    expect(profile).toEqual({ width: 200, height: 40, colorMode: "mono" });
    expect(JSON.stringify(profile)).not.toMatch(/620|993/);
  });

  it("falls back to the stored document profile when no ticker is available", () => {
    expect(resolveEditorProfile({ ticker: null, document: blankComposition(lobbyProfile) })).toEqual(lobbyProfile);
    expect(resolveEditorProfile({ ticker: { id: "tkr_x" }, document: null })).toBeNull();
  });
});

describe("layer editing", () => {
  it("adds a text layer that can be selected and edited", () => {
    let doc = addTextLayer(emptyDoc(), "txt_1");
    expect(doc.layers[0]).toMatchObject({ id: "txt_1", type: "text", visible: true });
    expect(layerTypeLabel(doc.layers[0]!)).toBe("Text");
    doc = updateLayer(doc, "txt_1", (layer) =>
      layer.type === "text" ? { ...layer, props: { ...layer.props, text: "Lobby hours" } } : layer,
    );
    expect(layerLabel(doc.layers[0]!)).toBe("Lobby hours");
    expect(JSON.stringify(doc)).not.toMatch(/your message here/i);
  });

  it("adds an image layer that references assetId only", () => {
    const doc = addImageLayer(emptyDoc(), "ast_image", "img_1");
    expect(doc.layers[0]).toMatchObject({ type: "image", assetId: "ast_image" });
    expect(JSON.stringify(doc)).not.toMatch(/https?:\/\/|data:image|cdn\./i);
  });

  it("adds a Lottie layer that references assetId and loop", () => {
    let doc = addLottieLayer(emptyDoc(), "ast_lottie", "lot_1");
    expect(doc.layers[0]).toMatchObject({ type: "lottie", assetId: "ast_lottie", loop: true });
    doc = updateLayer(doc, "lot_1", (layer) => (layer.type === "lottie" ? { ...layer, loop: false } : layer));
    expect(doc.layers[0]).toMatchObject({ type: "lottie", loop: false, assetId: "ast_lottie" });
  });

  it("toggles visibility and updates z-index and geometry", () => {
    let doc = addTextLayer(emptyDoc(), "txt_1");
    doc = setLayerVisible(doc, "txt_1", false);
    expect(doc.layers[0]?.visible).toBe(false);
    doc = setLayerGeometry(doc, "txt_1", { x: 8, y: 4, width: 40, height: 12, zIndex: 30 });
    expect(doc.layers[0]).toMatchObject({ x: 8, y: 4, width: 40, height: 12, zIndex: 30, visible: false });
  });

  it("updates scroll when the schema supports it", () => {
    let doc = addTextLayer(emptyDoc(), "txt_1");
    doc = updateLayer(doc, "txt_1", (layer) =>
      layer.type === "text" ? { ...layer, props: { ...layer.props, scrollPxPerSec: 48 } } : layer,
    );
    const text = doc.layers[0];
    expect(text && text.type === "text" ? text.props.scrollPxPerSec : null).toBe(48);
  });

  it("rejects invalid numeric values", () => {
    expect(parseEditorInteger("abc", 1).ok).toBe(false);
    expect(parseEditorInteger(0, 1).ok).toBe(false);
    expect(parseEditorInteger(-2, 0).ok).toBe(false);
    expect(parseEditorInteger(12, 1)).toEqual({ ok: true, value: 12 });
    const invalid = addImageLayer(emptyDoc(), "ast_image", "img_1");
    invalid.layers[0]!.width = 0;
    expect(canSaveDocument(invalid).ok).toBe(false);
  });
});

describe("assets", () => {
  it("lists real image and Lottie assets and shows empty states", () => {
    const items = [
      { id: "ast_1", name: "Logo", kind: "image" },
      { id: "ast_2", name: "Diya", kind: "lottie" },
    ];
    expect(assetsByKind(items, "image")).toEqual([expect.objectContaining({ id: "ast_1", name: "Logo" })]);
    expect(assetsByKind(items, "lottie")).toEqual([expect.objectContaining({ id: "ast_2", name: "Diya" })]);
    expect(assetsByKind([], "image")).toEqual([]);
    expect(EDITOR_NO_IMAGE_ASSETS).toBe("No image assets available.");
    expect(EDITOR_NO_LOTTIE_ASSETS).toBe("No Lottie assets available.");
    expect(EDITOR_EMPTY_MESSAGE).not.toMatch(/your message here/i);
  });
});

describe("save and dirty state", () => {
  it("save payload creates a draft document version without mutating publishedVersionId", () => {
    const doc = addTextLayer(emptyDoc(), "txt_1");
    const body = saveDraftBody("Lobby hours", doc);
    expect(body).toEqual(editorSaveBody("Lobby hours", doc));
    expect(publishedVersionUntouched({ publishedVersionId: "ver_pub", saveBody: body })).toBe(true);
    expect(hasPublishedVersion("ver_pub")).toBe(true);
    expect(hasPublishedVersion(null)).toBe(false);
  });

  it("tracks dirty, saving, saved, and failure copy", () => {
    const doc = addTextLayer(emptyDoc(), "txt_1");
    const baseline = editorSnapshot("Lobby", doc);
    expect(editorDirty({ title: "Lobby", document: doc, baseline })).toBe(false);
    expect(editorDirty({ title: "Lobby hours", document: doc, baseline })).toBe(true);
    expect(editorSaveStatus({ dirty: true, saving: false })).toBe(EDITOR_UNSAVED_LABEL);
    expect(editorSaveStatus({ dirty: true, saving: true })).toBe(EDITOR_SAVING_LABEL);
    expect(editorSaveStatus({ dirty: false, saving: false })).toBe(EDITOR_SAVED_LABEL);
    expect(editorSubmitLabel(true)).toBe(EDITOR_SAVING_LABEL);
    expect(EDITOR_SAVE_SUCCESS).toBe("Version saved.");
    expect(EDITOR_SAVE_ERROR).toBe("Unable to save this version.");
  });

  it("does not claim assigned tickers when publish has no targets", () => {
    expect(editorPublishMessage()).toBe(EDITOR_PUBLISH_SUCCESS);
    expect(editorPublishMessage({ selectedTickerId: null, deliveries: 0 })).toBe("Content published.");
    expect(editorPublishMessage({ selectedTickerId: null, deliveries: 0 })).not.toMatch(/assigned ticker/i);
  });
});

describe("session", () => {
  it("keeps authenticated 401 session invalidation unchanged", () => {
    expect(shouldInvalidateSession("/v1/contents/cnt_1", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/contents/cnt_1", 403)).toBe(false);
    expect(shouldInvalidateSession("/v1/assets", 401)).toBe(true);
  });
});
