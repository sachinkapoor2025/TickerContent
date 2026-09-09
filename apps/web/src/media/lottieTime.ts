export function lottieFrameIndex(timeMs: number, totalFrames: number, frameRate: number, loop: boolean): number {
  if (totalFrames <= 0) return 0;
  const raw = (timeMs / 1000) * (frameRate || 30);
  if (loop) {
    const wrapped = raw % totalFrames;
    return wrapped < 0 ? wrapped + totalFrames : wrapped;
  }
  return Math.min(Math.max(raw, 0), totalFrames - 1);
}
