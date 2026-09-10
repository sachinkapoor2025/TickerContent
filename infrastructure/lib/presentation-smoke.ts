export function looksLikeHtml(body: string, contentType: string | null): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html")) return true;
  const trimmed = body.trimStart();
  return trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html");
}

export function parseApiJson(body: string, contentType: string | null): unknown {
  if (looksLikeHtml(body, contentType)) {
    throw new Error("Response was HTML instead of JSON");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Response was not valid JSON");
  }
}

export function assertHealthPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("Health payload is not an object");
  }
  const record = payload as { ok?: unknown; service?: unknown };
  if (record.ok !== true) {
    throw new Error("Health payload ok is not true");
  }
  if (record.service !== "ticker-cms-api") {
    throw new Error("Health payload service is not ticker-cms-api");
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

async function readResponse(url: string, init: RequestInit, fetchImpl: FetchLike): Promise<{ status: number; contentType: string | null; body: string }> {
  const res = await fetchImpl(url, init);
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    body: await res.text(),
  };
}

export async function checkHealth(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, "")}/health`;
  const { status, contentType, body } = await readResponse(url, { method: "GET" }, fetchImpl);
  const payload = parseApiJson(body, contentType);
  if (status !== 200) {
    throw new Error(`${url} returned HTTP ${status}`);
  }
  assertHealthPayload(payload);
}

export async function checkLoginReturnsJson(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/auth/login`;
  const { contentType, body } = await readResponse(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "smoke@example.invalid", password: "not-a-real-login" }),
    },
    fetchImpl,
  );
  parseApiJson(body, contentType);
}

const PLAYER_TITLE = "<title>Ticker Player</title>";
const CUSTOMER_SPA_TITLE = "<title>Photonplay</title>";

export function assertPlayerHtml(body: string, contentType: string | null): string[] {
  if (!looksLikeHtml(body, contentType)) {
    throw new Error("Player response was not HTML");
  }
  if (body.includes(CUSTOMER_SPA_TITLE)) {
    throw new Error("Player route returned the Customer SPA");
  }
  if (!body.includes(PLAYER_TITLE)) {
    throw new Error("Player HTML is missing the Ticker Player title");
  }
  const assets = [...body.matchAll(/(?:src|href)="(\/player\/assets\/[^"]+\.(?:js|css))"/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
  if (assets.length === 0) {
    throw new Error("Player HTML has no /player/assets JS or CSS");
  }
  return [...new Set(assets)];
}

export async function checkPlayerHtml(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/player/`;
  const { status, contentType, body } = await readResponse(url, { method: "GET" }, fetchImpl);
  if (status !== 200) {
    throw new Error(`${url} returned HTTP ${status}`);
  }
  return assertPlayerHtml(body, contentType);
}

export async function checkPlayerAsset(
  baseUrl: string,
  assetPath: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  if (!assetPath.startsWith("/player/assets/")) {
    throw new Error("Refusing to fetch a path outside /player/assets/");
  }
  const url = `${baseUrl.replace(/\/+$/, "")}${assetPath}`;
  const { status, contentType, body } = await readResponse(url, { method: "GET" }, fetchImpl);
  if (status !== 200) {
    throw new Error(`${url} returned HTTP ${status}`);
  }
  if (looksLikeHtml(body, contentType)) {
    throw new Error("Player static asset was HTML instead of JS/CSS");
  }
}

export async function checkPlayerSurface(baseUrl: string, fetchImpl: FetchLike = fetch): Promise<void> {
  const assets = await checkPlayerHtml(baseUrl, fetchImpl);
  const assetPath = assets[0];
  if (!assetPath) {
    throw new Error("Player HTML has no /player/assets JS or CSS");
  }
  await checkPlayerAsset(baseUrl, assetPath, fetchImpl);
}
