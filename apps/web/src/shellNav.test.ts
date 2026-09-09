import { describe, expect, it } from "vitest";
import { ASSISTANT_DEFAULT_OPEN, CUSTOMER_NAV, customerHeader, navItemCurrent } from "./shellNav.js";

describe("customer shell navigation", () => {
  it("keeps working routes ahead of unavailable capabilities", () => {
    const groups = CUSTOMER_NAV.map((item) => item.group);
    expect(groups.slice(0, 10)).toEqual([
      "Workspace",
      "Workspace",
      "Workspace",
      "Workspace",
      "Workspace",
      "Workspace",
      "Publishing",
      "Team",
      "Account",
      "Account",
    ]);
    expect(CUSTOMER_NAV.filter((item) => item.unavailable).map((item) => item.id)).toEqual([
      "account",
      "schedules",
      "usage",
      "notifications",
    ]);
    expect(CUSTOMER_NAV.every((item) => item.unavailable || item.group !== "Coming later")).toBe(true);
  });

  it("keeps customer ticker terminology", () => {
    expect(CUSTOMER_NAV.find((item) => item.id === "tickers")?.label).toBe("My Tickers");
    expect(CUSTOMER_NAV.some((item) => item.label === "Displays")).toBe(false);
  });

  it("marks nested editor and ticker pages as their parent section", () => {
    const content = CUSTOMER_NAV.find((item) => item.id === "content")!;
    const tickers = CUSTOMER_NAV.find((item) => item.id === "tickers")!;
    const account = CUSTOMER_NAV.find((item) => item.id === "account")!;
    const subscription = CUSTOMER_NAV.find((item) => item.id === "subscription")!;
    expect(navItemCurrent(content, "/content/cnt_1")).toBe(true);
    expect(navItemCurrent(content, "/content/cnt_1/edit")).toBe(true);
    expect(navItemCurrent(tickers, "/tickers/tkr_1")).toBe(true);
    const campaigns = CUSTOMER_NAV.find((item) => item.id === "campaigns")!;
    expect(navItemCurrent(campaigns, "/campaigns/cmp_1")).toBe(true);
    const assets = CUSTOMER_NAV.find((item) => item.id === "assets")!;
    expect(navItemCurrent(assets, "/assets/ast_1")).toBe(true);
    expect(navItemCurrent(account, "/account/subscription")).toBe(false);
    expect(navItemCurrent(subscription, "/account/subscription")).toBe(true);
  });

  it("uses organization name in the shell and avoids duplicating list-page titles", () => {
    expect(customerHeader("/", "Demo Venue")).toEqual({ title: "Demo Venue" });
    expect(customerHeader("/tickers", "Demo Venue").meta).toBeUndefined();
    expect(customerHeader("/tickers/tkr_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "My Tickers" });
    expect(customerHeader("/content/cnt_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "Content" });
    expect(customerHeader("/content/cnt_1/edit", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "Content" });
    expect(customerHeader("/campaigns/cmp_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "Campaigns" });
    expect(customerHeader("/assets/ast_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "Assets" });
    expect(customerHeader("/schedules", null)).toEqual({ title: "Workspace" });
  });

  it("keeps the assistant closed by default", () => {
    expect(ASSISTANT_DEFAULT_OPEN).toBe(false);
  });
});
