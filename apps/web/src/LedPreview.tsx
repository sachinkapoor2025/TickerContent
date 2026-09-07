import { useEffect, useRef } from "react";
import { renderFrame, type CompositionDocument } from "@ticker-cms/composition";

export function LedPreview({
  document,
  className,
}: {
  document: CompositionDocument | null | undefined;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !document) return;
    canvas.width = document.profile.width;
    canvas.height = document.profile.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      renderFrame(document, ctx, t - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [document]);
  if (!document) return <div className={`led-empty ${className ?? ""}`}>No preview</div>;
  return <canvas ref={ref} className={`led-canvas ${className ?? ""}`} />;
}
