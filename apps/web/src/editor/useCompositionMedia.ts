import { useEffect, useMemo, useState } from "react";
import type { CompositionDocument, RenderResources } from "@ticker-cms/composition";
import { token } from "../api";
import { AssetMediaSession } from "../media/assetClient";
import { createLottieRenderer } from "../media/lottieRenderer";
import { referencedMediaAssetIds } from "./documentOps";

export function useCompositionMedia(doc: CompositionDocument | null) {
  const session = useMemo(
    () =>
      new AssetMediaSession({
        fetch: globalThis.fetch.bind(globalThis),
        getToken: () => token(),
      }),
    [],
  );
  const [images, setImages] = useState<Record<string, CanvasImageSource>>({});
  const [lottieJson, setLottieJson] = useState<Map<string, Record<string, unknown>>>(() => new Map());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!doc) return;
    const refs = referencedMediaAssetIds(doc);
    let cancelled = false;
    (async () => {
      try {
        const nextImages: Record<string, CanvasImageSource> = {};
        const nextLottie = new Map<string, Record<string, unknown>>();
        for (const assetId of refs.images) {
          nextImages[assetId] = await session.loadImage(assetId);
        }
        for (const assetId of refs.lottie) {
          nextLottie.set(assetId, await session.loadLottie(assetId));
        }
        if (!cancelled) {
          setImages(nextImages);
          setLottieJson(nextLottie);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, session]);

  const resources: RenderResources = useMemo(
    () => ({
      images,
      renderLottie: createLottieRenderer(lottieJson),
    }),
    [images, lottieJson],
  );

  return { resources, error };
}
