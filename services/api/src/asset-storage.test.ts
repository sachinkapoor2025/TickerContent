import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const isolatedDir = mkdtempSync(join(tmpdir(), "ticker-cms-storage-"));
process.env.TICKER_DATA_DIR = isolatedDir;

const {
  createAssetStorageFromEnv,
  createLocalAssetStorage,
  createS3AssetStorage,
  s3AssetObjectKey,
  writeAssetObject,
} = await import("./asset-storage.js");
type S3SendClient = import("./asset-storage.js").S3SendClient;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function mockS3() {
  const objects = new Map<string, Buffer>();
  const calls: Array<{ name: string; bucket?: string; key?: string }> = [];
  const client: S3SendClient = {
    async send(command) {
      const name = command.constructor.name;
      const input = (command as { input?: { Bucket?: string; Key?: string; Body?: Buffer } }).input ?? {};
      calls.push({ name, bucket: input.Bucket, key: input.Key });
      if (command instanceof PutObjectCommand) {
        objects.set(`${input.Bucket}/${input.Key}`, Buffer.from(input.Body ?? []));
        return {};
      }
      if (command instanceof GetObjectCommand) {
        const body = objects.get(`${input.Bucket}/${input.Key}`);
        if (!body) {
          const error = new Error("missing") as Error & { name: string; $metadata: { httpStatusCode: number } };
          error.name = "NoSuchKey";
          error.$metadata = { httpStatusCode: 404 };
          throw error;
        }
        return { Body: body };
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(`${input.Bucket}/${input.Key}`);
        return {};
      }
      throw new Error(`unexpected command ${name}`);
    },
  };
  return { client, calls, objects };
}

describe("local asset storage", () => {
  it("saves, reads, and deletes under the local assets directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "ticker-assets-"));
    const storage = createLocalAssetStorage(root);
    await storage.save("ast_1.png", PNG);
    expect(existsSync(join(root, "ast_1.png"))).toBe(true);
    expect((await storage.read("ast_1.png"))?.equals(PNG)).toBe(true);
    await storage.delete("ast_1.png");
    expect(await storage.read("ast_1.png")).toBeNull();
  });

  it("rejects path-escaping storage keys", async () => {
    const storage = createLocalAssetStorage(mkdtempSync(join(tmpdir(), "ticker-assets-")));
    await expect(storage.save("../secret.png", PNG)).rejects.toThrow("invalid_storage_key");
    await expect(storage.save("nested/key.png", PNG)).rejects.toThrow("invalid_storage_key");
  });
});

describe("S3 asset keys", () => {
  it("scopes object keys to the organization", () => {
    expect(s3AssetObjectKey("ast_abc.png", "org_tenant1")).toBe("assets/org_tenant1/ast_abc.png");
    expect(s3AssetObjectKey("ast_abc.json", null)).toBe("assets/platform/ast_abc.json");
  });

  it("cannot escape the assets/{organizationId}/ prefix", () => {
    expect(() => s3AssetObjectKey("../passwd", "org_tenant1")).toThrow("invalid_storage_key");
    expect(() => s3AssetObjectKey("ast_abc.png", "../other")).toThrow("invalid_storage_key");
    expect(() => s3AssetObjectKey("a/b.png", "org_tenant1")).toThrow("invalid_storage_key");
    expect(() => s3AssetObjectKey("ast_abc.png", "org/tenant")).toThrow("invalid_storage_key");
  });
});

describe("S3 asset storage", () => {
  it("is constructed from env without hardcoded credentials", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "asset-storage.ts"), "utf8");
    expect(source).toContain("new S3Client({})");
    expect(source).not.toMatch(/accessKeyId\s*:/);
    expect(source).not.toMatch(/secretAccessKey\s*:/);
    expect(source.includes("AKIA")).toBe(false);

    const storage = createAssetStorageFromEnv({
      ASSET_STORAGE: "s3",
      ASSET_BUCKET: "ticker-cms-assets-test",
    });
    expect(storage).toBeTruthy();
  });

  it("fails clearly when S3 mode has no bucket", () => {
    expect(() => createAssetStorageFromEnv({ ASSET_STORAGE: "s3" })).toThrow(/ASSET_BUCKET/);
  });

  it("does not silently fall back from an unknown storage mode", () => {
    expect(() => createAssetStorageFromEnv({ ASSET_STORAGE: "memory" })).toThrow(/Unknown ASSET_STORAGE/);
  });

  it("defaults to local storage", () => {
    expect(() => createAssetStorageFromEnv({})).not.toThrow();
    expect(() => createAssetStorageFromEnv({ ASSET_STORAGE: "local" })).not.toThrow();
  });

  it("uploads with PutObject, reads with GetObject, and deletes with DeleteObject", async () => {
    const { client, calls } = mockS3();
    const storage = createS3AssetStorage({ bucket: "ticker-assets", client });
    const context = { organizationId: "org_alpha" };

    await storage.save("ast_1.png", PNG, context);
    expect(calls[0]).toEqual({ name: "PutObjectCommand", bucket: "ticker-assets", key: "assets/org_alpha/ast_1.png" });

    const read = await storage.read("ast_1.png", context);
    expect(calls[1]?.name).toBe("GetObjectCommand");
    expect(read?.equals(PNG)).toBe(true);

    await storage.delete("ast_1.png", context);
    expect(calls[2]?.name).toBe("DeleteObjectCommand");
    expect(await storage.read("ast_1.png", context)).toBeNull();
  });

  it("cleans up the S3 object when the database commit fails", async () => {
    const { client, calls } = mockS3();
    const storage = createS3AssetStorage({ bucket: "ticker-assets", client });
    const context = { organizationId: "org_alpha" };
    await expect(
      writeAssetObject(storage, "ast_fail.png", PNG, context, () => {
        throw new Error("db insert failed");
      }),
    ).rejects.toThrow("db insert failed");
    expect(calls.map((call) => call.name)).toEqual(["PutObjectCommand", "DeleteObjectCommand"]);
    expect(await storage.read("ast_fail.png", context)).toBeNull();
  });

  it("does not commit a database record when S3 upload fails", async () => {
    let committed = false;
    const client: S3SendClient = {
      async send() {
        throw new Error("S3 unavailable");
      },
    };
    const storage = createS3AssetStorage({ bucket: "ticker-assets", client });
    await expect(
      writeAssetObject(storage, "ast_no.png", PNG, { organizationId: "org_alpha" }, () => {
        committed = true;
      }),
    ).rejects.toThrow("S3 unavailable");
    expect(committed).toBe(false);
  });
});
