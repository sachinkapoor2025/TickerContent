import { useEffect, useRef } from "react";
import { renderFrame, type CompositionDocument, type DisplayProfile, type RenderResources } from "@ticker-cms/composition";
import {
  layoutGapOverlay,
  ledMonoColor,
  quantizeLedPixels,
  tickerDisplayProfile,
  type TickerDisplayScale,
} from "./ledPresentation";
import "./ledTicker.css";

export type TickerDisplayProps = {
  document?: CompositionDocument | null;
  profile?: DisplayProfile | null;
  resources?: RenderResources;
  label?: string;
  scale?: TickerDisplayScale;
  emptyMessage?: string;
  className?: string;
  timeOffsetMs?: number;
};

export function TickerDisplay({
  document,
  profile,
  resources,
  label = "LED ticker",
  scale = "responsive",
  emptyMessage = "No preview",
  className,
  timeOffsetMs = 0,
}: TickerDisplayProps) {
  const ledRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef(resources);
  resourcesRef.current = resources;
  const display = tickerDisplayProfile(document, profile);

  useEffect(() => {
    const led = ledRef.current;
    const overlay = overlayRef.current;
    const wrap = wrapRef.current;
    if (!led || !overlay || !wrap || !document) return;
    const ctx = led.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return;
    const width = document.profile.width;
    const height = document.profile.height;
    led.width = width;
    led.height = height;
    ctx.imageSmoothingEnabled = false;
    const start = performance.now();
    let raf = 0;

    const syncOverlay = () => {
      layoutGapOverlay(overlay, width, height);
    };
    syncOverlay();

    const loop = (now: number) => {
      ctx.imageSmoothingEnabled = false;
      renderFrame(document, ctx, now - start + timeOffsetMs, resourcesRef.current);
      const pixels = ctx.getImageData(0, 0, width, height);
      quantizeLedPixels(pixels.data, {
        mono: document.profile.colorMode === "mono",
        monoColor: ledMonoColor(document),
      });
      ctx.putImageData(pixels, 0, 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const resize = new ResizeObserver(syncOverlay);
    resize.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
    };
  }, [document, timeOffsetMs]);

  return (
    <div className={`ticker-display ticker-display--${scale}${className ? ` ${className}` : ""}`}>
      <div className="ticker-display__frame">
        <div
          className="ticker-display__panel"
          ref={wrapRef}
          style={{ aspectRatio: `${display.width} / ${display.height}` }}
        >
          {document ? (
            <>
              <canvas
                ref={ledRef}
                className="ticker-display__led"
                width={display.width}
                height={display.height}
                role="img"
                aria-label={label}
              />
              <canvas className="ticker-display__gaps" ref={overlayRef} aria-hidden="true" />
            </>
          ) : (
            <p className="ticker-display__empty">{emptyMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
