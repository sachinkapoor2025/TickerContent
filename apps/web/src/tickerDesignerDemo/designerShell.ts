import type { ShellNavItem } from "@ticker-cms/ui";

export const DESIGNER_PAGE_TITLE = "Design Your Ticker";
export const DESIGNER_PAGE_DESCRIPTION = "Build your message and see it come alive on your LED ticker.";
export const DESIGNER_EMPTY_HINT = "Start building your ticker by adding a block.";
export const DESIGNER_SELECT_HINT = "Select a block to edit.";
export const DESIGNER_BRAND_LABEL = "Photonplay";
export const DESIGNER_CONTEXT_LABEL = "Workspace";

export const DESIGNER_PUBLIC_NAV: ShellNavItem[] = [
  {
    id: "ticker-designer",
    label: "Design Your Ticker",
    icon: "tickers",
    to: "/ticker-designer-demo",
    end: true,
    current: true,
    group: "Workspace",
  },
];
