import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import { addImageLayer, addLottieLayer, blankComposition } from "./editor/documentOps.js";
import { assetsByKind } from "./editor/editorState.js";
import {
  ASSETS_EDITOR_NOTE,
  ASSETS_EMPTY_DESCRIPTION,
  ASSETS_EMPTY_TITLE,
  ASSETS_ERROR_MESSAGE,
  ASSETS_LOADING_MESSAGE,
  ASSETS_PAGE_DESCRIPTION,
  ASSET_DELETE_PROMPT,
  ASSET_FILE_REQUIRED,
  ASSET_IMAGE_PREVIEW_UNAVAILABLE,
  ASSET_LOTTIE_PREVIEW_UNAVAILABLE,
  ASSET_STACK_MAX_PX,
  ASSET_UPLOADING_LABEL,
  ASSET_UPLOAD_ERROR,
  ASSET_UPLOAD_SUCCESS,
  assetCanDelete,
  assetDetailPageState,
  assetListRows,
  assetSubmitLabel,
  assetTypeLabel,
  assetsPageState,
  createdAssetHref,
  findAsset,
  formatAssetSize,
  lottieAssetRows,
  needsAssetStackList,
  validateAssetFile,
  type AssetRecord,
} from "./assetData.js";

const image: AssetRecord = {
  id: "ast_img",
  organizationId: "org_secret",
  name: "Lobby logo",
  kind: "image",
  mimeType: "image/png",
  sizeBytes: 2048,
  status: "ready",
  storageKey: "/var/lib/ticker/ast_img.png",
};

const lottie: AssetRecord = {
  id: "ast_lot",
  organizationId: "org_secret",
  name: "Diya loop",
  kind: "lottie",
  mimeType: "application/json",
  sizeBytes: 12_288,
  status: "ready",
};

const platform: AssetRecord = {
  id: "asset_platform_diya",
  organizationId: null,
  name: "Platform diya",
  kind: "lottie",
  mimeType: "application/json",
  sizeBytes: 100,
};

describe("assets workspace copy", () => {
  it("describes real image and Lottie management without extra media types", () => {
    expect(ASSETS_PAGE_DESCRIPTION).toBe("Manage the images and media used in your content.");
    expect(ASSETS_PAGE_DESCRIPTION).not.toMatch(/video|audio|svg|gif|pdf|thumbnail|downloads|views/i);
    expect(ASSETS_EMPTY_TITLE).toBe("No assets yet");
    expect(ASSETS_EMPTY_DESCRIPTION).toBe("Upload an image or Lottie asset to use it in your content.");
    expect(ASSETS_EDITOR_NOTE).toBe("Assets can be added to content from the editor.");
  });
});

describe("asset list mapping", () => {
  it("maps name, type, and size without exposing storage or organization ids", () => {
    const rows = assetListRows([image, lottie, platform]);
    expect(rows[0]).toMatchObject({
      id: "ast_img",
      name: "Lobby logo",
      href: "/assets/ast_img",
      typeLabel: "Image",
      sizeLabel: "2 KB",
      canDelete: true,
    });
    expect(rows[1]).toMatchObject({ name: "Diya loop", typeLabel: "Lottie", canDelete: true });
    expect(rows[2]?.canDelete).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/storageKey|org_secret|organizationId|\/var\/lib/);
    expect(assetTypeLabel("image")).toBe("Image");
    expect(assetTypeLabel("lottie")).toBe("Lottie");
    expect(formatAssetSize(512)).toBe("512 B");
  });
});

describe("upload presentation", () => {
  it("requires a file and uses Uploading… plus success and failure copy", () => {
    expect(validateAssetFile(null).ok).toBe(false);
    if (validateAssetFile(null).ok) return;
    expect(validateAssetFile(null).message).toBe(ASSET_FILE_REQUIRED);
    expect(assetSubmitLabel(true)).toBe(ASSET_UPLOADING_LABEL);
    expect(assetSubmitLabel(false)).toBe("Upload");
    expect(ASSET_UPLOAD_SUCCESS).toBe("Asset uploaded.");
    expect(ASSET_UPLOAD_ERROR).toBe("Unable to upload asset.");
  });
});

describe("asset detail and preview", () => {
  it("presents image and Lottie assets for preview without inventing other types", () => {
    const imagePage = assetDetailPageState({ loading: false, error: null, item: image });
    const lottiePage = assetDetailPageState({ loading: false, error: null, item: lottie });
    expect(imagePage.kind).toBe("ready");
    expect(lottiePage.kind).toBe("ready");
    if (imagePage.kind !== "ready" || lottiePage.kind !== "ready") return;
    expect(imagePage.view.previewKind).toBe("image");
    expect(lottiePage.view.previewKind).toBe("lottie");
    expect(ASSET_IMAGE_PREVIEW_UNAVAILABLE).toBe("Preview unavailable");
    expect(ASSET_LOTTIE_PREVIEW_UNAVAILABLE).toBe("Lottie preview unavailable");
    expect(createdAssetHref("ast_img")).toBe("/assets/ast_img");
    expect(findAsset([image], "ast_img")?.id).toBe("ast_img");
  });
});

describe("empty, loading, error, and delete", () => {
  it("uses honest empty, loading, and error states", () => {
    expect(assetsPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: ASSETS_LOADING_MESSAGE,
    });
    expect(assetsPageState({ loading: false, error: null, items: [] })).toMatchObject({ kind: "ready", empty: true });
    expect(assetsPageState({ loading: false, error: null, items: null }).kind).toBe("error");
    expect(ASSETS_ERROR_MESSAGE).toBe("Unable to load your assets.");
  });

  it("requires confirmation copy for org-owned delete and skips platform assets", () => {
    expect(ASSET_DELETE_PROMPT).toBe("Delete asset?");
    expect(assetCanDelete(image)).toBe(true);
    expect(assetCanDelete(platform)).toBe(false);
  });
});

describe("editor assetId integration", () => {
  it("preserves the same assetId the editor uses for image and Lottie layers", () => {
    const rows = assetListRows([image, lottie]);
    expect(assetsByKind([image, lottie], "image")[0]?.id).toBe(rows[0]?.id);
    expect(assetsByKind([image, lottie], "lottie")[0]?.id).toBe(rows[1]?.id);
    const profile = { width: 620, height: 64, colorMode: "full" as const };
    const withImage = addImageLayer(blankComposition(profile), rows[0]!.id);
    const withLottie = addLottieLayer(blankComposition(profile), rows[1]!.id);
    expect(withImage.layers.some((layer) => layer.type === "image" && layer.assetId === "ast_img")).toBe(true);
    expect(withLottie.layers.some((layer) => layer.type === "lottie" && layer.assetId === "ast_lot")).toBe(true);
    expect(lottieAssetRows([image, lottie]).map((row) => row.id)).toEqual(["ast_lot"]);
  });
});

describe("tenancy and session", () => {
  it("does not treat client organizationId as authorization", () => {
    const rows = assetListRows([{ ...image, organizationId: "org_other" }]);
    expect(rows[0]?.id).toBe("ast_img");
    expect(rows.every((row) => !("organizationId" in row))).toBe(true);
  });

  it("keeps 401 session invalidation and leaves 403 to authorization", () => {
    expect(shouldInvalidateSession("/v1/assets", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/assets/ast_1/content", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/assets", 403)).toBe(false);
  });
});

describe("mobile stack helper", () => {
  it("uses the existing stack breakpoint", () => {
    expect(needsAssetStackList(390)).toBe(true);
    expect(needsAssetStackList(ASSET_STACK_MAX_PX)).toBe(true);
    expect(needsAssetStackList(1440)).toBe(false);
  });
});
