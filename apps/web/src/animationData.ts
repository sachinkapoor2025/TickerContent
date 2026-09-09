import { lottieAssetRows, type AssetListRow, type AssetRecord } from "./assetData";

export const ANIMATIONS_LOADING_MESSAGE = "Loading animations…";
export const ANIMATIONS_ERROR_MESSAGE = "Unable to load your animations.";
export const ANIMATIONS_PAGE_DESCRIPTION = "Use Lottie animations in your content.";
export const ANIMATIONS_EMPTY_TITLE = "No Lottie assets yet";
export const ANIMATIONS_EMPTY_DESCRIPTION = "Upload a Lottie JSON file from Assets to use it in the editor.";
export const ANIMATIONS_PACKS_EMPTY = "No animation packs are available.";
export const ANIMATIONS_STACK_MAX_PX = 720;

export type AnimationPackRecord = {
  id?: string;
  name?: string | null;
  category?: string | null;
  entitled?: boolean | null;
  entitlementKey?: string | null;
  slug?: string | null;
  items?: unknown;
};

export type AnimationPackRow = {
  id: string;
  name: string;
  category: string;
  accessLabel: string;
};

export type AnimationsPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      packs: AnimationPackRow[];
      packsEmpty: boolean;
      lottie: AssetListRow[];
      lottieEmpty: boolean;
    };

function presentName(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

export function animationAccessLabel(entitled: unknown) {
  return entitled ? "Included" : "Not on this plan";
}

export function animationPackRows(items: AnimationPackRecord[] | undefined): AnimationPackRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AnimationPackRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      name: presentName(item.name, "Animation pack"),
      category: presentName(item.category, "—"),
      accessLabel: animationAccessLabel(item.entitled),
    }));
}

export function needsAnimationStackList(viewportWidth: number) {
  return viewportWidth <= ANIMATIONS_STACK_MAX_PX;
}

export function animationsPageState(input: {
  loading: boolean;
  error: string | null;
  packs: AnimationPackRecord[] | null;
  assets: AssetRecord[] | null;
}): AnimationsPageState {
  if (input.loading) return { kind: "loading", message: ANIMATIONS_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.packs || !input.assets) {
    return { kind: "error", message: error || ANIMATIONS_ERROR_MESSAGE };
  }
  const packs = animationPackRows(input.packs);
  const lottie = lottieAssetRows(input.assets);
  return {
    kind: "ready",
    packs,
    packsEmpty: packs.length === 0,
    lottie,
    lottieEmpty: lottie.length === 0,
  };
}
