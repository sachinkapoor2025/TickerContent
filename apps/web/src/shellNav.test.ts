import { describe, expect, it } from "vitest";
import { tickerDesignHref } from "./tickerData.js";
import { ASSISTANT_DEFAULT_OPEN, CUSTOMER_NAV, customerHeader, customerLegacyRedirect, navItemCurrent } from "./shellNav.js";

describe("customer shell navigation", () => {
  it("keeps working routes ahead of unavailable capabilities", () => {
    const groups = CUSTOMER_NAV.map((item) => item.group);
    expect(groups.slice(0, 8)).toEqual([
      "Workspace",
      "Workspace",
      "Workspace",
      "Workspace",
      "Workspace",
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

  it("removes Content and Campaigns from customer navigation", () => {
    expect(CUSTOMER_NAV.some((item) => item.label === "Content" || item.to === "/content" || item.id === "content")).toBe(
      false,
    );
    expect(
      CUSTOMER_NAV.some((item) => item.label === "Campaigns" || item.to === "/campaigns" || item.id === "campaigns"),
    ).toBe(false);
    expect(CUSTOMER_NAV.find((item) => item.id === "tickers")).toMatchObject({ label: "My Tickers", to: "/tickers" });
  });

  it("keeps My Tickers and Design Your Ticker reachable", () => {
    expect(CUSTOMER_NAV.some((item) => item.to === "/tickers")).toBe(true);
    expect(tickerDesignHref("tkr_1")).toBe("/tickers/tkr_1/design");
    expect(navItemCurrent(CUSTOMER_NAV.find((item) => item.id === "tickers")!, "/tickers/tkr_1/design")).toBe(true);
  });

  it("redirects old content and campaign pages to My Tickers", () => {
    expect(customerLegacyRedirect("/content")).toBe("/tickers");
    expect(customerLegacyRedirect("/content/cnt_1")).toBe("/tickers");
    expect(customerLegacyRedirect("/content/cnt_1/edit")).toBe("/tickers");
    expect(customerLegacyRedirect("/campaigns")).toBe("/tickers");
    expect(customerLegacyRedirect("/campaigns/cmp_1")).toBe("/tickers");
    expect(customerLegacyRedirect("/tickers")).toBeNull();
    expect(customerLegacyRedirect("/tickers/tkr_1/design")).toBeNull();
    expect(customerLegacyRedirect("/")).toBeNull();
  });

  it("marks nested ticker pages as their parent section", () => {
    const tickers = CUSTOMER_NAV.find((item) => item.id === "tickers")!;
    const account = CUSTOMER_NAV.find((item) => item.id === "account")!;
    const subscription = CUSTOMER_NAV.find((item) => item.id === "subscription")!;
    expect(navItemCurrent(tickers, "/tickers/tkr_1")).toBe(true);
    expect(navItemCurrent(tickers, "/tickers/tkr_1/design")).toBe(true);
    const assets = CUSTOMER_NAV.find((item) => item.id === "assets")!;
    expect(navItemCurrent(assets, "/assets/ast_1")).toBe(true);
    expect(navItemCurrent(account, "/account/subscription")).toBe(false);
    expect(navItemCurrent(subscription, "/account/subscription")).toBe(true);
  });

  it("uses organization name in the shell and avoids duplicating list-page titles", () => {
    expect(customerHeader("/", "Demo Venue")).toEqual({ title: "Demo Venue" });
    expect(customerHeader("/tickers", "Demo Venue").meta).toBeUndefined();
    expect(customerHeader("/tickers/tkr_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "My Tickers" });
    expect(customerHeader("/tickers/tkr_1/design", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "My Tickers" });
    expect(customerHeader("/content/cnt_1", "Demo Venue")).toEqual({ title: "Demo Venue" });
    expect(customerHeader("/campaigns/cmp_1", "Demo Venue")).toEqual({ title: "Demo Venue" });
    expect(customerHeader("/assets/ast_1", "Demo Venue")).toEqual({ title: "Demo Venue", meta: "Assets" });
    expect(customerHeader("/schedules", null)).toEqual({ title: "Workspace" });
  });

  it("does not add Stimulate to customer portal navigation", () => {
    expect(CUSTOMER_NAV.some((item) => item.to === "/stimulate" || /stimulate/i.test(item.label))).toBe(false);
  });

  it("does not add the ticker designer demo to customer portal navigation", () => {
    expect(CUSTOMER_NAV.some((item) => item.to === "/ticker-designer-demo")).toBe(false);
  });

  it("keeps the assistant closed by default", () => {
    expect(ASSISTANT_DEFAULT_OPEN).toBe(false);
  });
});
