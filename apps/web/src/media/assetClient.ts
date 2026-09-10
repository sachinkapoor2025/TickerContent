export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class AssetLoadError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AssetLoadError";
    this.status = status;
  }
}

export type LoadedBytes = {
  buffer: ArrayBuffer;
  contentType: string;
};

export function parseLottieJson(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AssetLoadError("Lottie asset is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AssetLoadError("Lottie asset must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/** Call fetch with a Window-like `this` so passing unbound `window.fetch` does not throw. */
export function invokeFetch(fetchFn: FetchLike, input: string, init?: RequestInit): Promise<Response> {
  return Reflect.apply(fetchFn, globalThis, [input, init]);
}

export async function fetchAssetContent(
  assetId: string,
  deps: { fetch: FetchLike; token: string | null },
): Promise<LoadedBytes> {
  const headers = new Headers();
  if (deps.token) headers.set("authorization", `Bearer ${deps.token}`);
  const res = await invokeFetch(deps.fetch, `/v1/assets/${encodeURIComponent(assetId)}/content`, { headers });
  if (!res.ok) {
    throw new AssetLoadError(res.status === 404 ? "Asset not found." : "Failed to load asset.", res.status);
  }
  return { buffer: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "" };
}

export async function decodeImageBytes(buffer: ArrayBuffer): Promise<CanvasImageSource> {
  const blob = new Blob([buffer]);
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw new AssetLoadError("Invalid image data.");
    }
  }
  return decodeImageElement(blob);
}

function decodeImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AssetLoadError("Invalid image data."));
    };
    image.src = url;
  });
}

/** In-memory session cache for decoded media. Not persisted. */
export class AssetMediaSession {
  readonly images = new Map<string, CanvasImageSource>();
  readonly lottie = new Map<string, Record<string, unknown>>();
  private inflight = new Map<string, Promise<void>>();

  constructor(private deps: { fetch: FetchLike; getToken: () => string | null }) {}

  async loadImage(assetId: string): Promise<CanvasImageSource> {
    const cached = this.images.get(assetId);
    if (cached) return cached;
    await this.ensure(assetId, "image");
    const image = this.images.get(assetId);
    if (!image) throw new AssetLoadError("Invalid image data.");
    return image;
  }

  async loadLottie(assetId: string): Promise<Record<string, unknown>> {
    const cached = this.lottie.get(assetId);
    if (cached) return cached;
    await this.ensure(assetId, "lottie");
    const json = this.lottie.get(assetId);
    if (!json) throw new AssetLoadError("Lottie asset is not valid JSON.");
    return json;
  }

  private ensure(assetId: string, kind: "image" | "lottie"): Promise<void> {
    const key = `${kind}:${assetId}`;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const work = (async () => {
      const { buffer } = await fetchAssetContent(assetId, {
        fetch: this.deps.fetch,
        token: this.deps.getToken(),
      });
      if (kind === "image") {
        this.images.set(assetId, await decodeImageBytes(buffer));
      } else {
        this.lottie.set(assetId, parseLottieJson(new TextDecoder().decode(buffer)));
      }
    })().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, work);
    return work;
  }
}
