import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-only-change-me");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

export type TokenClaims = {
  sub: string;
  orgId: string | null;
  audience: "tenant" | "platform";
  email: string;
};

export async function signToken(claims: TokenClaims, expires = "12h"): Promise<string> {
  return new SignJWT({ orgId: claims.orgId, audience: claims.audience, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: String(payload.sub),
    orgId: (payload.orgId as string | null) ?? null,
    audience: (payload.audience as "tenant" | "platform") ?? "tenant",
    email: String(payload.email ?? ""),
  };
}

export function id(prefix = ""): string {
  const raw = randomBytes(12).toString("hex");
  return prefix ? `${prefix}_${raw}` : raw;
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "org"
  );
}
