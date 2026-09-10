import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CUSTOMER_NAV } from "../shellNav";
import {
  STIMULATE_BRAND_LABEL,
  STIMULATE_CONTEXT_LABEL,
  STIMULATE_PAGE_DESCRIPTION,
  STIMULATE_PAGE_TITLE,
  STIMULATE_PUBLIC_NAV,
} from "./stimulateShell";

describe("stimulate public shell", () => {
  const pageSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "StimulatePage.tsx"), "utf8");

  it("uses Photonplay workspace chrome without customer CMS routes", () => {
    expect(STIMULATE_BRAND_LABEL).toBe("Photonplay");
    expect(STIMULATE_CONTEXT_LABEL).toBe("Workspace");
    expect(STIMULATE_PAGE_TITLE).toBe("Stimulate Your Ticker");
    expect(STIMULATE_PAGE_DESCRIPTION).toMatch(/real LED ticker/i);
    expect(STIMULATE_PUBLIC_NAV).toEqual([
      {
        id: "stimulate",
        label: "Stimulate Your Ticker",
        icon: "tickers",
        to: "/stimulate",
        end: true,
        current: true,
        group: "Workspace",
      },
    ]);
    expect(STIMULATE_PUBLIC_NAV.some((item) => item.to === "/stimulate")).toBe(true);
    expect(CUSTOMER_NAV.some((item) => item.to === "/stimulate")).toBe(false);
  });

  it("stays a public in-memory page without session, APIs, or account chrome", () => {
    expect(pageSrc).toContain("AppShell");
    expect(pageSrc).toContain("showLogout={false}");
    expect(pageSrc).toContain("TickerDisplay");
    expect(pageSrc).not.toMatch(/from ["']\.\.\/api["']/);
    expect(pageSrc).not.toContain("/v1");
    expect(pageSrc).not.toContain("/health");
    expect(pageSrc).not.toContain("useCustomerSession");
    expect(pageSrc).not.toContain("Demo Venue");
    expect(pageSrc).not.toContain("onLogout");
    expect(pageSrc).not.toMatch(/>Logout</);
  });
});
