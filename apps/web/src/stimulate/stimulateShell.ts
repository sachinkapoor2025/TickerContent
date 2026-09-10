import type { ShellNavItem } from "@ticker-cms/ui";

export const STIMULATE_PAGE_TITLE = "Stimulate Your Ticker";
export const STIMULATE_PAGE_DESCRIPTION = "Create a message and watch it come alive on a real LED ticker.";
export const STIMULATE_HEADER_TITLE = "Stimulate Your Ticker";
export const STIMULATE_BRAND_LABEL = "Photonplay";
export const STIMULATE_CONTEXT_LABEL = "Workspace";

export const STIMULATE_PUBLIC_NAV: ShellNavItem[] = [
  {
    id: "stimulate",
    label: "Stimulate Your Ticker",
    icon: "tickers",
    to: "/stimulate",
    end: true,
    current: true,
    group: "Workspace",
  },
];
