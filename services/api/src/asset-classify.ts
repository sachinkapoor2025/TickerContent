const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const RIFF = Buffer.from("RIFF");
const WEBP = Buffer.from("WEBP");

export type ClassifiedAsset = {
  kind: "image" | "lottie";
  mimeType: string;
};

function startsWith(bytes: Buffer, prefix: Buffer, offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.equals(bytes.subarray(offset, offset + prefix.length));
}

function sniffedImageMime(bytes: Buffer): string | null {
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

function isJsonObject(bytes: Buffer): boolean {
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

export function classifyAsset(bytes: Buffer, declaredType: string, fileName: string): ClassifiedAsset | { error: string } {
  if (bytes.length === 0) return { error: "Empty file." };
  const declared = declaredType.split(";")[0]?.trim().toLowerCase() ?? "";
  const imageMime = sniffedImageMime(bytes);
  if (imageMime) {
    if (declared && declared !== "application/octet-stream" && !declared.startsWith("image/")) {
      return { error: "File content does not match the declared type." };
    }
    return { kind: "image", mimeType: imageMime };
  }
  const looksJson =
    declared === "application/json" ||
    declared === "application/ld+json" ||
    fileName.toLowerCase().endsWith(".json");
  if (looksJson || declared === "application/octet-stream" || !declared) {
    if (!isJsonObject(bytes)) {
      if (looksJson) return { error: "Lottie assets must be valid JSON." };
      return { error: "Unsupported file type." };
    }
    return { kind: "lottie", mimeType: "application/json" };
  }
  return { error: "Unsupported file type." };
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "json";
}
