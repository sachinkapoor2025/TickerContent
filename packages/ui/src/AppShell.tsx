import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { shellIcons, type ShellIconName } from "./icons";

export type ShellNavItem = {
  id: string;
  label: string;
  icon: ShellIconName;
  to?: string;
  end?: boolean;
  current?: boolean;
  unavailable?: boolean;
  group?: string;
};

export type ShellLinkProps = {
  to: string;
  end?: boolean;
  className: string;
  children: ReactNode;
  title?: string;
  "aria-label"?: string;
  onClick?: () => void;
};

type AppShellProps = {
  product: "admin" | "customer";
  brandLabel: string;
  contextLabel: string;
  headerTitle: string;
  headerMeta?: string;
  navItems: ShellNavItem[];
  onLogout?: () => void;
  showLogout?: boolean;
  onNavSelect?: (item: ShellNavItem) => void;
  linkComponent?: ComponentType<ShellLinkProps>;
  children: ReactNode;
};

function itemClass(current: boolean, unavailable?: boolean) {
  return [
    "pp-nav__item",
    current ? "is-current" : "",
    unavailable ? "is-unavailable" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function AppShell({
  product,
  brandLabel,
  contextLabel,
  headerTitle,
  headerMeta,
  navItems,
  onLogout,
  showLogout = true,
  onNavSelect,
  linkComponent: Link,
  children,
}: AppShellProps) {
  const storageKey = `pp-shell-collapsed-${product}`;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(storageKey) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, collapsed ? "1" : "0");
  }, [collapsed, storageKey]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 960) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
  }

  const groups: { label?: string; items: ShellNavItem[] }[] = [];
  for (const item of navItems) {
    const last = groups[groups.length - 1];
    if (!last || last.label !== item.group) groups.push({ label: item.group, items: [item] });
    else last.items.push(item);
  }

  return (
    <div className="pp-shell" data-product={product} data-collapsed={collapsed ? "true" : "false"} data-mobile-open={mobileOpen ? "true" : "false"}>
      <a className="pp-skip" href="#pp-main">
        Skip to content
      </a>
      {mobileOpen && <button type="button" className="pp-backdrop" aria-label="Close navigation" onClick={closeMobile} />}
      <aside className="pp-sidebar">
        <div className="pp-sidebar__brand">
          <span className="pp-sidebar__mark">PP</span>
          <div className="pp-sidebar__titles">
            <p className="pp-sidebar__product">{brandLabel}</p>
            <p className="pp-sidebar__context">{contextLabel}</p>
          </div>
        </div>
        <nav className="pp-nav" aria-label="Primary">
          {groups.map((group) => (
            <div key={group.label ?? "main"}>
              {group.label ? <p className="pp-nav__group">{group.label}</p> : null}
              {group.items.map((item) => {
                const current = Boolean(item.current);
                const label = item.unavailable ? `${item.label} (not available in MVP)` : item.label;
                const body = (
                  <>
                    <span className="pp-nav__icon">{shellIcons[item.icon]}</span>
                    <span className="pp-nav__label">{item.label}</span>
                    {item.unavailable ? <span className="pp-nav__hint">Not available</span> : null}
                  </>
                );
                if (item.to && Link) {
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      end={item.end}
                      className={itemClass(current, item.unavailable)}
                      title={label}
                      aria-label={label}
                      onClick={closeMobile}
                    >
                      {body}
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={itemClass(current, item.unavailable)}
                    title={label}
                    aria-label={label}
                    aria-current={current ? "page" : undefined}
                    onClick={() => {
                      onNavSelect?.(item);
                      closeMobile();
                    }}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <header className="pp-header">
        <div className="pp-header__left">
          <button
            type="button"
            className="pp-icon-btn pp-header__menu"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            {shellIcons.menu}
          </button>
          <button
            type="button"
            className="pp-icon-btn pp-header__collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? shellIcons.expand : shellIcons.collapse}
          </button>
          <div className="pp-header__titles">
            <p className="pp-header__title">{headerTitle}</p>
            {headerMeta ? <p className="pp-header__meta">{headerMeta}</p> : null}
          </div>
        </div>
        <div className="pp-header__right">
          {showLogout && onLogout ? (
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onLogout}>
              Logout
            </button>
          ) : null}
        </div>
      </header>
      <main id="pp-main" className="pp-main" tabIndex={-1}>
        <div className="pp-main__inner">{children}</div>
      </main>
    </div>
  );
}
