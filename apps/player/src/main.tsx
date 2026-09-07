import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createDemoDocument, renderFrame } from "@ticker-cms/composition";

function Player() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const doc = createDemoDocument({ width: 993, height: 32, colorMode: "full" }, "Ticker CMS player  •  offline cache ready");
    canvas.width = doc.profile.width;
    canvas.height = doc.profile.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      renderFrame(doc, ctx, t - start);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} style={{ width: "100%", imageRendering: "pixelated" }} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Player />
  </StrictMode>,
);
