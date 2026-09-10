import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import {
  ANIMATIONS_EMPTY_DESCRIPTION,
  ANIMATIONS_EMPTY_TITLE,
  ANIMATIONS_ERROR_MESSAGE,
  ANIMATIONS_LOADING_MESSAGE,
  ANIMATIONS_PACKS_EMPTY,
  ANIMATIONS_PAGE_DESCRIPTION,
  ANIMATIONS_STACK_MAX_PX,
  animationPackRows,
  animationsPageState,
  needsAnimationStackList,
} from "./animationData.js";
import type { AssetRecord } from "./assetData.js";

const packs = [
  {
    id: "pack_festivals",
    name: "Festivals",
    category: "Festivals",
    entitled: true,
    entitlementKey: "packs.festivals",
    items: [{ id: "diya", name: "Diya loop", source: "generated" }],
  },
  {
    id: "pack_alerts",
    name: "Alerts",
    category: "Alerts",
    entitled: false,
    items: [{ id: "flash", name: "Attention flash", source: "reference:pumpkin.json" }],
  },
];

const lottie: AssetRecord = { id: "ast_lot", name: "Diya loop", kind: "lottie", organizationId: "org_1" };
const image: AssetRecord = { id: "ast_img", name: "Logo", kind: "image", organizationId: "org_1" };

describe("animations page", () => {
  it("maps real pack name, category, and plan access without inventing previews", () => {
    const rows = animationPackRows(packs);
    expect(rows).toEqual([
      { id: "pack_festivals", name: "Festivals", category: "Festivals", accessLabel: "Included" },
      { id: "pack_alerts", name: "Alerts", category: "Alerts", accessLabel: "Not on this plan" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/source|pumpkin\.json|entitlementKey|generated|preview|popular|recommended/i);
    expect(ANIMATIONS_PAGE_DESCRIPTION).toBe("Use Lottie animations in your content.");
  });

  it("shows real Lottie assets and ignores non-Lottie files", () => {
    const page = animationsPageState({
      loading: false,
      error: null,
      packs,
      assets: [lottie, image],
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.lottie.map((row) => row.name)).toEqual(["Diya loop"]);
    expect(page.lottieEmpty).toBe(false);
    expect(page.packsEmpty).toBe(false);
  });

  it("uses empty, loading, and error states without fake animation counts", () => {
    expect(animationsPageState({ loading: true, error: null, packs: null, assets: null })).toEqual({
      kind: "loading",
      message: ANIMATIONS_LOADING_MESSAGE,
    });
    const empty = animationsPageState({ loading: false, error: null, packs: [], assets: [] });
    expect(empty.kind).toBe("ready");
    if (empty.kind !== "ready") return;
    expect(empty.lottieEmpty).toBe(true);
    expect(empty.packsEmpty).toBe(true);
    expect(ANIMATIONS_EMPTY_TITLE).toBe("No Lottie assets yet");
    expect(ANIMATIONS_EMPTY_DESCRIPTION).toMatch(/Assets/);
    expect(ANIMATIONS_PACKS_EMPTY).toBe("No animation packs are available.");
    expect(animationsPageState({ loading: false, error: null, packs: null, assets: null }).kind).toBe("error");
    expect(ANIMATIONS_ERROR_MESSAGE).toBe("Unable to load your animations.");
    expect(JSON.stringify(empty)).not.toMatch(/usage|popular|count/i);
  });

  it("keeps session handling on the animation-packs and assets APIs", () => {
    expect(shouldInvalidateSession("/v1/animation-packs", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/animation-packs", 403)).toBe(false);
    expect(shouldInvalidateSession("/v1/assets", 401)).toBe(true);
  });

  it("uses the existing stack breakpoint", () => {
    expect(needsAnimationStackList(390)).toBe(true);
    expect(needsAnimationStackList(ANIMATIONS_STACK_MAX_PX)).toBe(true);
    expect(needsAnimationStackList(1440)).toBe(false);
  });
});
