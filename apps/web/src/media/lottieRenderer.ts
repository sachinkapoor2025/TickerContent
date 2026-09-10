import type { LottieRenderRequest } from "@ticker-cms/composition";
import lottie, { type AnimationItem } from "lottie-web";
import { lottieFrameIndex } from "./lottieTime.js";

type Handle = {
  anim: AnimationItem;
  canvas: HTMLCanvasElement | null;
};

function host(): HTMLElement {
  const id = "ticker-cms-lottie-host";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;left:-99999px;top:0;overflow:hidden;width:0;height:0;";
    document.body.appendChild(el);
  }
  return el;
}

export function createLottieRenderer(jsonByAssetId: Map<string, Record<string, unknown>>) {
  const handles = new Map<string, Handle>();

  return (request: LottieRenderRequest): CanvasImageSource | null => {
    const data = jsonByAssetId.get(request.assetId);
    if (!data || request.width <= 0 || request.height <= 0) return null;
    const key = `${request.assetId}:${request.width}x${request.height}`;
    let handle = handles.get(key);
    if (!handle) {
      const wrap = document.createElement("div");
      wrap.style.width = `${request.width}px`;
      wrap.style.height = `${request.height}px`;
      host().appendChild(wrap);
      const anim = lottie.loadAnimation({
        container: wrap,
        renderer: "canvas",
        loop: false,
        autoplay: false,
        animationData: JSON.parse(JSON.stringify(data)) as object,
        rendererSettings: {
          preserveAspectRatio: "none",
          clearCanvas: true,
        },
      });
      handle = { anim, canvas: wrap.querySelector("canvas") };
      anim.addEventListener("DOMLoaded", () => {
        handle!.canvas = wrap.querySelector("canvas");
      });
      handles.set(key, handle);
    }
    const fromRenderer = (handle.anim as AnimationItem & { renderer?: { canvas?: HTMLCanvasElement } }).renderer?.canvas;
    const canvas = handle.canvas ?? fromRenderer ?? null;
    handle.canvas = canvas;
    const total = handle.anim.totalFrames || 1;
    const fps = handle.anim.frameRate || 30;
    const loop = request.layer.loop !== false;
    handle.anim.goToAndStop(lottieFrameIndex(request.timeMs, total, fps, loop), true);
    return canvas;
  };
}
