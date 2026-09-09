import type { ReactNode } from "react";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {children}
    </svg>
  );
}

export const shellIcons = {
  dashboard: (
    <Glyph>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </Glyph>
  ),
  organizations: (
    <Glyph>
      <path d="M4 20V8l8-4 8 4v12" />
      <path d="M10 20v-6h4v6" />
    </Glyph>
  ),
  users: (
    <Glyph>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19c.5-3 2.5-5 5-5s4.5 2 5 5" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 19c.3-2 1.6-3.4 3.2-3.8" />
    </Glyph>
  ),
  devices: (
    <Glyph>
      <rect x="3.5" y="6.5" width="17" height="9" />
      <path d="M8 19h8" />
    </Glyph>
  ),
  assignments: (
    <Glyph>
      <rect x="5" y="3.5" width="14" height="17" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </Glyph>
  ),
  monitoring: (
    <Glyph>
      <path d="M3.5 12h4l2-5 3 10 2-5h6" />
    </Glyph>
  ),
  templates: (
    <Glyph>
      <rect x="4" y="4" width="16" height="16" />
      <path d="M4 9h16M9 9v11" />
    </Glyph>
  ),
  content: (
    <Glyph>
      <rect x="4" y="5" width="16" height="14" />
      <path d="M8 9h8M8 13h5" />
    </Glyph>
  ),
  plans: (
    <Glyph>
      <path d="M4 18h16M6 18V8l6-4 6 4v10" />
    </Glyph>
  ),
  subscriptions: (
    <Glyph>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </Glyph>
  ),
  analytics: (
    <Glyph>
      <path d="M4 19V10M10 19V5M16 19v-7M20 19H3" />
    </Glyph>
  ),
  support: (
    <Glyph>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 10a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.8-1.1 1.8M12 17h.01" />
    </Glyph>
  ),
  notifications: (
    <Glyph>
      <path d="M6 16V10a6 6 0 1 1 12 0v6l2 2H4l2-2z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </Glyph>
  ),
  settings: (
    <Glyph>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.7 6.5l1.6 1.6M17.7 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.7 17.5l1.6-1.6M17.7 8.1l1.6-1.6" />
    </Glyph>
  ),
  audit: (
    <Glyph>
      <path d="M7 4.5h10v15H7z" />
      <path d="M10 8h4M10 12h4M10 16h3" />
    </Glyph>
  ),
  tickers: (
    <Glyph>
      <rect x="3" y="8" width="18" height="8" />
      <path d="M6 12h2M11 12h6" />
    </Glyph>
  ),
  schedules: (
    <Glyph>
      <rect x="4" y="5" width="16" height="15" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" />
    </Glyph>
  ),
  usage: (
    <Glyph>
      <path d="M4 16l4-4 3 3 6-7" />
      <path d="M4 19h16" />
    </Glyph>
  ),
  account: (
    <Glyph>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c1-4 3.5-6 7-6s6 2 7 6" />
    </Glyph>
  ),
  assets: (
    <Glyph>
      <rect x="4" y="7" width="16" height="12" />
      <path d="M4 12h16M9 7V5h6v2" />
    </Glyph>
  ),
  animations: (
    <Glyph>
      <rect x="4" y="6" width="12" height="12" />
      <path d="M16 10l4-2v12l-4-2" />
    </Glyph>
  ),
  menu: (
    <Glyph>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </Glyph>
  ),
  collapse: (
    <Glyph>
      <path d="M15 6l-6 6 6 6" />
    </Glyph>
  ),
  expand: (
    <Glyph>
      <path d="M9 6l6 6-6 6" />
    </Glyph>
  ),
} as const;

export type ShellIconName = keyof typeof shellIcons;
