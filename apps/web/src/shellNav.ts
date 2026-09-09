import type { ShellNavItem } from "@ticker-cms/ui";

export const CUSTOMER_NAV: ShellNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", to: "/", end: true, group: "Workspace" },
  { id: "tickers", label: "My Tickers", icon: "tickers", to: "/tickers", group: "Workspace" },
  { id: "content", label: "Content", icon: "content", to: "/content", group: "Workspace" },
  { id: "templates", label: "Templates", icon: "templates", to: "/templates", group: "Workspace" },
  { id: "assets", label: "Assets", icon: "assets", to: "/assets", group: "Workspace" },
  { id: "animations", label: "Animations", icon: "animations", to: "/animations", group: "Workspace" },
  { id: "campaigns", label: "Campaigns", icon: "assignments", to: "/campaigns", group: "Publishing" },
  { id: "users", label: "Users", icon: "users", to: "/users", group: "Team" },
  { id: "subscription", label: "Subscription", icon: "subscriptions", to: "/account/subscription", group: "Account" },
  { id: "audit", label: "Audit", icon: "audit", to: "/audit", group: "Account" },
  { id: "account", label: "Account", icon: "account", to: "/account", end: true, group: "Coming later", unavailable: true },
  { id: "schedules", label: "Schedules", icon: "schedules", to: "/schedules", group: "Coming later", unavailable: true },
  { id: "usage", label: "Usage", icon: "usage", to: "/usage", group: "Coming later", unavailable: true },
  { id: "notifications", label: "Notifications", icon: "notifications", to: "/notifications", group: "Coming later", unavailable: true },
];

export const ASSISTANT_DEFAULT_OPEN = false;

export function navItemCurrent(item: ShellNavItem, pathname: string) {
  if (!item.to) return false;
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function customerHeader(pathname: string, organizationName?: string | null): { title: string; meta?: string } {
  const title = organizationName?.trim() || "Workspace";
  const current = CUSTOMER_NAV.find((item) => navItemCurrent(item, pathname));
  if (!current?.to) return { title };
  const nested = pathname !== current.to && pathname.startsWith(`${current.to}/`);
  if (nested) return { title, meta: current.label };
  return { title };
}
