import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3Client as S3ClientType,
} from "@aws-sdk/client-s3";
import { DATA_DIR } from "./db.js";

export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

export type AssetStorageContext = {
  organizationId?: string | null;
};

export type AssetStorage = {
  save(key: string, bytes: Buffer, context?: AssetStorageContext): Promise<void>;
  read(key: string, context?: AssetStorageContext): Promise<Buffer | null>;
  delete(key: string, context?: AssetStorageContext): Promise<void>;
};

export function assertSafeKey(key: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key) || key.includes("..")) {
    throw new Error("invalid_storage_key");
  }
}

export function s3AssetObjectKey(storageKey: string, organizationId?: string | null): string {
  assertSafeKey(storageKey);
  const tenant = organizationId ? organizationId : "platform";
  assertSafeKey(tenant);
  const objectKey = `assets/${tenant}/${storageKey}`;
  const parts = objectKey.split("/");
  if (parts.length !== 3 || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("invalid_storage_key");
  }
  return objectKey;
}

export function createLocalAssetStorage(rootDir = resolve(DATA_DIR, "assets")): AssetStorage {
  mkdirSync(rootDir, { recursive: true });
  const root = resolve(rootDir);

  function resolveKey(key: string): string {
    assertSafeKey(key);
    const full = resolve(root, key);
    const rel = relative(root, full);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || rel.includes(`..${sep}`)) {
      throw new Error("invalid_storage_key");
    }
    return full;
  }

  return {
    async save(key, bytes) {
      writeFileSync(resolveKey(key), bytes);
    },
    async read(key) {
      try {
        return readFileSync(resolveKey(key));
      } catch {
        return null;
      }
    },
    async delete(key) {
      try {
        unlinkSync(resolveKey(key));
      } catch {
        // missing file is fine
      }
    },
  };
}

export type S3SendClient = Pick<S3ClientType, "send">;

export function createS3AssetStorage(options: { bucket: string; client?: S3SendClient }): AssetStorage {
  const bucket = options.bucket.trim();
  if (!bucket) {
    throw new Error("ASSET_STORAGE=s3 requires ASSET_BUCKET");
  }
  const client = options.client ?? new S3Client({});

  return {
    async save(key, bytes, context) {
      const objectKey = s3AssetObjectKey(key, context?.organizationId);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: bytes,
        }),
      );
    },
    async read(key, context) {
      const objectKey = s3AssetObjectKey(key, context?.organizationId);
      try {
        const result = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );
        return await bodyToBuffer(result.Body);
      } catch (error) {
        if (isS3NotFound(error)) return null;
        throw error;
      }
    },
    async delete(key, context) {
      const objectKey = s3AssetObjectKey(key, context?.organizationId);
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectKey,
          }),
        );
      } catch (error) {
        if (isS3NotFound(error)) return;
        throw error;
      }
    },
  };
}

export async function writeAssetObject(
  storage: AssetStorage,
  key: string,
  bytes: Buffer,
  context: AssetStorageContext | undefined,
  commit: () => void,
): Promise<void> {
  await storage.save(key, bytes, context);
  try {
    commit();
  } catch (error) {
    await storage.delete(key, context);
    throw error;
  }
}

export function createAssetStorageFromEnv(env: NodeJS.Dict<string> = process.env): AssetStorage {
  const mode = (env.ASSET_STORAGE ?? "local").trim().toLowerCase();
  if (mode === "s3") {
    const bucket = env.ASSET_BUCKET?.trim();
    if (!bucket) {
      throw new Error("ASSET_STORAGE=s3 requires ASSET_BUCKET");
    }
    return createS3AssetStorage({ bucket });
  }
  if (mode && mode !== "local") {
    throw new Error(`Unknown ASSET_STORAGE="${mode}". Use "local" or "s3".`);
  }
  return createLocalAssetStorage();
}

export const assetStorage = createAssetStorageFromEnv();

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "object" && body && "transformToByteArray" in body) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  throw new Error("unsupported_s3_body");
}

function isS3NotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "Code" in error ? String((error as { Code?: string }).Code) : "";
  const httpStatus = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return name === "NoSuchKey" || name === "NotFound" || code === "NoSuchKey" || httpStatus === 404;
}
