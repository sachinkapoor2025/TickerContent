import type { CompositionDocument } from "@ticker-cms/composition";
import { AssetMediaSession } from "../../web/src/media/assetClient";
import { referencedAssetIds } from "./playback";

export async function loadReferencedMedia(
  doc: CompositionDocument,
  session: AssetMediaSession,
): Promise<{ images: Record<string, CanvasImageSource>; lottie: Map<string, Record<string, unknown>> }> {
  const refs = referencedAssetIds(doc);
  const images: Record<string, CanvasImageSource> = {};
  const lottie = new Map<string, Record<string, unknown>>();
  await Promise.all([
    ...refs.images.map(async (assetId) => {
      try {
        images[assetId] = await session.loadImage(assetId);
      } catch (err) {
        console.warn("Player image asset failed", assetId, err);
      }
    }),
    ...refs.lottie.map(async (assetId) => {
      try {
        lottie.set(assetId, await session.loadLottie(assetId));
      } catch (err) {
        console.warn("Player lottie asset failed", assetId, err);
      }
    }),
  ]);
  return { images, lottie };
}
