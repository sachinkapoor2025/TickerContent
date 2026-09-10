#!/usr/bin/env npx ts-node
import { checkHealth, checkLoginReturnsJson, checkPlayerSurface } from "../lib/presentation-smoke";

type Args = {
  albUrl?: string;
  webUrl?: string;
  adminUrl?: string;
  attempts: number;
  delayMs: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { attempts: 18, delayMs: 10_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--alb-url" && value) args.albUrl = value;
    if (key === "--web-url" && value) args.webUrl = value;
    if (key === "--admin-url" && value) args.adminUrl = value;
    if (key === "--attempts" && value) args.attempts = Number(value);
    if (key === "--delay-ms" && value) args.delayMs = Number(value);
  }
  return args;
}

async function retry(label: string, attempts: number, delayMs: number, work: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await work();
      console.log(`${label}: ok`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`${label}: attempt ${attempt}/${attempts} failed`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.albUrl && !args.webUrl && !args.adminUrl) {
    throw new Error("Provide at least one of --alb-url, --web-url, --admin-url");
  }
  if (args.albUrl) {
    await retry("ALB GET /health", args.attempts, args.delayMs, () => checkHealth(args.albUrl!));
  }
  if (args.webUrl) {
    await retry("Customer CloudFront GET /health", args.attempts, args.delayMs, () => checkHealth(args.webUrl!));
    await retry("Customer CloudFront POST /v1/auth/login JSON", args.attempts, args.delayMs, () =>
      checkLoginReturnsJson(args.webUrl!),
    );
    await retry("Customer CloudFront GET /player/", args.attempts, args.delayMs, () =>
      checkPlayerSurface(args.webUrl!),
    );
  }
  if (args.adminUrl) {
    await retry("Admin CloudFront GET /health", args.attempts, args.delayMs, () => checkHealth(args.adminUrl!));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
