import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CUSTOMER_NAV } from "../shellNav";
import {
  DESIGNER_BRAND_LABEL,
  DESIGNER_CONTEXT_LABEL,
  DESIGNER_EMPTY_HINT,
  DESIGNER_PAGE_DESCRIPTION,
  DESIGNER_PAGE_TITLE,
  DESIGNER_PUBLIC_NAV,
} from "./designerShell";

describe("ticker designer public shell", () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const pageSrc = readFileSync(join(dir, "TickerDesignerDemoPage.tsx"), "utf8");
  const canvasSrc = readFileSync(join(dir, "DesignerCanvas.tsx"), "utf8");
  const cssSrc = readFileSync(join(dir, "tickerDesignerDemo.css"), "utf8");
  const src = `${pageSrc}\n${canvasSrc}`;

  it("uses Photonplay workspace chrome without customer CMS routes", () => {
    expect(DESIGNER_BRAND_LABEL).toBe("Photonplay");
    expect(DESIGNER_CONTEXT_LABEL).toBe("Workspace");
    expect(DESIGNER_PAGE_TITLE).toBe("Design Your Ticker");
    expect(DESIGNER_PAGE_DESCRIPTION).toBe("Build your message and see it come alive on your LED ticker.");
    expect(DESIGNER_EMPTY_HINT).toBe("Start building your ticker by adding a block.");
    expect(DESIGNER_PUBLIC_NAV).toEqual([
      {
        id: "ticker-designer",
        label: "Design Your Ticker",
        icon: "tickers",
        to: "/ticker-designer-demo",
        end: true,
        current: true,
        group: "Workspace",
      },
    ]);
    expect(CUSTOMER_NAV.some((item) => item.to === "/ticker-designer-demo")).toBe(false);
  });

  it("stays a public in-memory designer without session, APIs, or CMS terms", () => {
    expect(pageSrc).toContain("AppShell");
    expect(pageSrc).toContain("showLogout={false}");
    expect(src).toContain("TickerDisplay");
    expect(src).toContain("Add block");
    expect(src).toContain("Block settings");
    expect(src).toContain("Your ticker flow");
    expect(src).toContain("designer-modal");
    expect(src).toContain("designer-toast");
    expect(src).not.toContain("Hello I am Nitin");
    expect(src).not.toContain("designer-acc");
    expect(src).not.toMatch(/from ["']\.\.\/api["']/);
    expect(src).not.toContain("/v1");
    expect(src).not.toContain("/health");
    expect(src).not.toContain("useCustomerSession");
    expect(src).not.toContain("Demo Venue");
    expect(pageSrc).not.toContain("onLogout");
    expect(src).not.toMatch(/>Logout</);
    expect(src).not.toMatch(/\bCampaign\b/);
    expect(src).not.toMatch(/\bContent version\b/);
    expect(src).not.toContain("schemaVersion");
    expect(src).not.toContain("z-index");
    expect(src).toContain("Search emoji...");
    expect(src).toContain("Choose an emoji");
    expect(src).toContain("designer-emoji-palette");
    expect(src).not.toContain('htmlFor="designer-emoji"');
    expect(src).not.toContain('id="designer-emoji"');
    expect(src).toContain("Test Connection");
    expect(src).toContain("Demo only");
    expect(src).toContain("Enter API URL");
    expect(src).toContain("Occasion");
    expect(src).toContain("Decoration");
    expect(src).toContain("RGB keeps emoji colors. Mono uses one LED color.");
    expect(src).not.toContain("fetch(");
    expect(src).not.toContain("Scheduled");
    expect(cssSrc).toContain("min-width: 180px");
    expect(cssSrc).toContain("min-width: 140px");
    expect(cssSrc).toContain("position: fixed");
    expect(cssSrc).toContain("flex-wrap");
    expect(cssSrc).toContain("designer-modal");
    expect(cssSrc).toContain("designer-toast");
    expect(cssSrc).not.toMatch(/overflow-x:\s*auto/);
  });
});
