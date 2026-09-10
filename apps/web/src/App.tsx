import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { AppShell, AuthLayout, UnavailablePanel, type ShellLinkProps } from "@ticker-cms/ui";
import { api, ApiError, clearCustomerSession, onSessionInvalidated, setToken, token } from "./api";
import { TickerDisplay } from "./components/TickerDisplay";
import { asCompositionDocument } from "./components/ledPresentation";
import { Tickers } from "./Tickers";
import { TickerDesignPage } from "./TickerDesignPage";
import { TickerDetail } from "./TickerDetail";
import { AssetDetail } from "./AssetDetail";
import { AssetLibrary } from "./AssetLibrary";
import { AnimationLibrary } from "./AnimationLibrary";
import { TemplateLibrary } from "./TemplateLibrary";
import {
  CUSTOMER_REGISTER_FIELDS,
  PLATFORM_WORKSPACE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UNABLE_TO_REGISTER_MESSAGE,
  buildCustomerRegisterPayload,
  customerSignInError,
  evaluateLoginToken,
  evaluateTenantMe,
  initialSessionStatus,
  type CustomerMe,
} from "./session";
import {
  NOW_PLAYING_EMPTY,
  NOW_PLAYING_LOADING_MESSAGE,
  NOW_PLAYING_PLAYBACK_ERROR,
  NOW_PLAYING_SELECT_LABEL,
  dashboardPageState,
  dashboardTickerOptions,
  nowPlayingPlaybackPath,
  nowPlayingStorageKey,
  readPersistedNowPlayingTickerId,
  resolveNowPlayingTickerId,
  writePersistedNowPlayingTickerId,
  type DashboardResponse,
  type DashboardTicker,
} from "./dashboardData";
import { ASSISTANT_DEFAULT_OPEN, CUSTOMER_NAV, customerHeader, customerLegacyRedirect, navItemCurrent } from "./shellNav";
import { CustomerRoleProvider, useCustomerAccess } from "./CustomerRole";
import { ASSISTANT_SEND_ERROR, assistantSubmitState } from "./assistantChat";
import {
  USERS_EMPTY_DESCRIPTION,
  USERS_EMPTY_TITLE,
  USERS_PAGE_DESCRIPTION,
  USER_INVITE_ERROR,
  USER_INVITE_SUCCESS,
  userInviteLabel,
  usersPageState,
  validateUserInvite,
  workspaceRoleLabel,
  CUSTOMER_INVITE_ROLES,
  type MembershipRecord,
} from "./userData";
import {
  SIMULATED_STATUSES,
  SUBSCRIPTION_PAGE_DESCRIPTION,
  SUBSCRIPTION_SIMULATE_ERROR,
  SUBSCRIPTION_SIMULATION_NOTE,
  subscriptionPageState,
  type SubscriptionResponse,
} from "./subscriptionData";
import {
  AUDIT_EMPTY_DESCRIPTION,
  AUDIT_EMPTY_TITLE,
  AUDIT_PAGE_DESCRIPTION,
  auditPageState,
  type AuditRecord,
} from "./auditData";
import {
  TICKERS_EMPTY_DESCRIPTION,
  type TickerPlayback,
} from "./tickerData";
import { StimulatePage } from "./stimulate/StimulatePage";
import { TickerDesignerDemoPage } from "./tickerDesignerDemo/TickerDesignerDemoPage";

type Me = CustomerMe;

type SessionStatus = "checking" | "unauthenticated" | "authenticated" | "error";

function useCustomerSession() {
  const [status, setStatus] = useState<SessionStatus>(() => initialSessionStatus(Boolean(token())));
  const [me, setMe] = useState<Me | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  function becomeUnauthenticated(message?: string) {
    clearCustomerSession();
    setMe(null);
    setStatus("unauthenticated");
    setSessionError(null);
    setAuthMessage(message ?? null);
  }

  async function verifySession() {
    if (!token()) {
      setStatus("unauthenticated");
      setMe(null);
      return;
    }
    setStatus("checking");
    setSessionError(null);
    try {
      const data = await api<Me>("/v1/me");
      const decision = evaluateTenantMe(data);
      if (!decision.ok) {
        becomeUnauthenticated(decision.message);
        return;
      }
      setMe(decision.me);
      setAuthMessage(null);
      setStatus("authenticated");
    } catch (err) {
      const error = err as { status?: number };
      if (error.status === 401 || !token()) {
        becomeUnauthenticated(SESSION_EXPIRED_MESSAGE);
        return;
      }
      setMe(null);
      setSessionError("Unable to verify your session. Please try again.");
      setStatus("error");
    }
  }

  useEffect(() => {
    void verifySession();
  }, []);

  useEffect(() => {
    return onSessionInvalidated(() => {
      becomeUnauthenticated(SESSION_EXPIRED_MESSAGE);
    });
  }, []);

  return {
    status,
    me,
    authMessage,
    sessionError,
    becomeUnauthenticated,
    accept: (next: Me) => {
      setMe(next);
      setAuthMessage(null);
      setSessionError(null);
      setStatus("authenticated");
    },
    retry: () => {
      void verifySession();
    },
  };
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === "/stimulate") {
    return <StimulatePage />;
  }
  if (pathname === "/ticker-designer-demo") {
    return <TickerDesignerDemoPage />;
  }
  return <CustomerPortal />;
}

function CustomerPortal() {
  const session = useCustomerSession();
  if (session.status === "checking") {
    return (
      <AuthLayout productLabel="Photonplay" title="Checking your session…">
        <p className="muted">Please wait.</p>
      </AuthLayout>
    );
  }
  if (session.status === "error") {
    return (
      <AuthLayout productLabel="Photonplay" title="Unable to continue">
        <p className="error" role="alert">
          {session.sessionError}
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={session.retry}>
            Try again
          </button>
          <button className="btn ghost" type="button" onClick={() => session.becomeUnauthenticated()}>
            Sign in
          </button>
        </div>
      </AuthLayout>
    );
  }
  return (
    <Routes>
      <Route
        path="/login"
        element={<Login authenticated={session.status === "authenticated"} authMessage={session.authMessage} onAuthenticated={session.accept} />}
      />
      <Route
        path="/register"
        element={<Register authenticated={session.status === "authenticated"} onAuthenticated={session.accept} />}
      />
      <Route path="/*" element={session.status === "authenticated" && session.me ? <Authed me={session.me} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

function CustomerLink({ to, end, className, children, title, onClick, "aria-label": ariaLabel }: ShellLinkProps) {
  return (
    <NavLink to={to} end={end} className={className} title={title} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </NavLink>
  );
}

function CustomerLegacyRedirect() {
  const { pathname } = useLocation();
  return <Navigate to={customerLegacyRedirect(pathname) ?? "/tickers"} replace />;
}

function Authed({ me }: { me: Me }) {
  const location = useLocation();
  const navItems = CUSTOMER_NAV.map((item) => ({ ...item, current: navItemCurrent(item, location.pathname) }));
  const header = customerHeader(location.pathname, me.organization?.name);
  return (
    <CustomerRoleProvider roleKey={me.roleKey}>
    <AppShell
      product="customer"
      brandLabel="Photonplay"
      contextLabel="Workspace"
      headerTitle={header.title}
      headerMeta={header.meta}
      navItems={navItems}
      linkComponent={CustomerLink}
      onLogout={() => {
        setToken(null);
        window.location.href = "/login";
      }}
    >
      <Routes>
        <Route path="/" element={<Dashboard me={me} />} />
        <Route path="/tickers" element={<Tickers />} />
        <Route path="/tickers/:id/design" element={<TickerDesignPage />} />
        <Route path="/tickers/:id" element={<TickerDetail />} />
        <Route path="/content/*" element={<CustomerLegacyRedirect />} />
        <Route path="/content" element={<CustomerLegacyRedirect />} />
        <Route path="/templates" element={<TemplateLibrary />} />
        <Route path="/animations" element={<AnimationLibrary />} />
        <Route path="/campaigns/*" element={<CustomerLegacyRedirect />} />
        <Route path="/campaigns" element={<CustomerLegacyRedirect />} />
        <Route path="/assets" element={<AssetLibrary />} />
        <Route path="/assets/:id" element={<AssetDetail />} />
        <Route path="/users" element={<Users />} />
        <Route path="/account/subscription" element={<Subscription />} />
        <Route path="/account" element={<UnavailablePanel title="Account" />} />
        <Route path="/schedules" element={<UnavailablePanel title="Schedules" />} />
        <Route path="/usage" element={<UnavailablePanel title="Usage" />} />
        <Route path="/notifications" element={<UnavailablePanel title="Notifications" />} />
        <Route path="/audit" element={<Audit />} />
      </Routes>
      <ChatDock />
    </AppShell>
    </CustomerRoleProvider>
  );
}

async function completeTenantSignIn(
  payload: unknown,
  onAuthenticated: (me: Me) => void,
) {
  const login = evaluateLoginToken(payload);
  if (!login.ok) {
    clearCustomerSession();
    throw new Error(login.message);
  }
  setToken(login.token);
  const me = evaluateTenantMe(await api<Me>("/v1/me"));
  if (!me.ok) {
    clearCustomerSession();
    throw new Error(me.message);
  }
  onAuthenticated(me.me);
}

function Login({
  authenticated,
  authMessage,
  onAuthenticated,
}: {
  authenticated: boolean;
  authMessage: string | null;
  onAuthenticated: (me: Me) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(authMessage ?? "");
  useEffect(() => {
    if (authMessage) setError(authMessage);
  }, [authMessage]);
  if (authenticated) return <Navigate to="/" replace />;
  return (
    <AuthLayout productLabel="Photonplay" title="Sign in">
      <form
        aria-describedby={error ? "login-error" : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const res = await api("/v1/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password }),
            });
            await completeTenantSignIn(res, onAuthenticated);
          } catch (err) {
            clearCustomerSession();
            const message = (err as Error).message;
            setError(message === PLATFORM_WORKSPACE_MESSAGE ? message : customerSignInError(err));
          }
        }}
      >
        <label className="pp-field" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          className="pp-input"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="pp-field" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          className="pp-input"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? (
          <p id="login-error" className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" type="submit">
            Login
          </button>
          <Link to="/register">Create your account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

function Register({
  authenticated,
  onAuthenticated,
}: {
  authenticated: boolean;
  onAuthenticated: (me: Me) => void;
}) {
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  if (authenticated) return <Navigate to="/" replace />;
  return (
    <AuthLayout productLabel="Photonplay" title="Create your account">
      <form
        aria-describedby={error ? "register-error" : undefined}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const res = await api("/v1/auth/register", {
              method: "POST",
              body: JSON.stringify(buildCustomerRegisterPayload(form)),
            });
            await completeTenantSignIn(res, onAuthenticated);
          } catch (err) {
            clearCustomerSession();
            const message = (err as Error).message;
            setError(message === PLATFORM_WORKSPACE_MESSAGE ? message : customerSignInError(err, UNABLE_TO_REGISTER_MESSAGE));
          }
        }}
      >
        {CUSTOMER_REGISTER_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="pp-field" htmlFor={field.id}>
              {field.label}
            </label>
            <input
              id={field.id}
              className="pp-input"
              type={field.type}
              name={field.key}
              autoComplete={field.autoComplete}
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            />
          </div>
        ))}
        {error ? (
          <p id="register-error" className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn" style={{ marginTop: 16 }} type="submit">
          Create account
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Dashboard({ me }: { me: Me }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTickerId, setSelectedTickerId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<TickerPlayback | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const { canManageTickers } = useCustomerAccess();

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api<DashboardResponse>("/v1/dashboard"), api<{ items: DashboardTicker[] }>("/v1/tickers")])
      .then(([payload, tickerList]) => {
        const tickers = Array.isArray(tickerList.items) ? tickerList.items : payload.tickers;
        setData({
          ...payload,
          tickers,
        });
        const options = dashboardTickerOptions(tickers);
        const persisted = readPersistedNowPlayingTickerId(window.localStorage, storageKey);
        setSelectedTickerId(resolveNowPlayingTickerId(persisted, options));
        setLoading(false);
      })
      .catch((err) => {
        setData(null);
        setError((err as Error).message?.trim() || "Unable to load the dashboard.");
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const tickers = dashboardTickerOptions(data?.tickers);
  const storageKey = nowPlayingStorageKey(me?.user.id, me?.organization?.id);

  useEffect(() => {
    if (!data) return;
    const options = dashboardTickerOptions(data.tickers);
    const persisted = readPersistedNowPlayingTickerId(window.localStorage, storageKey);
    setSelectedTickerId((current) => {
      const preferred = current && options.some((ticker) => ticker.id === current) ? current : persisted;
      return resolveNowPlayingTickerId(preferred, options);
    });
  }, [data, storageKey]);

  useEffect(() => {
    if (selectedTickerId) writePersistedNowPlayingTickerId(window.localStorage, storageKey, selectedTickerId);
  }, [selectedTickerId, storageKey]);

  useEffect(() => {
    if (!selectedTickerId) {
      setPlayback(null);
      setPlaybackError("");
      setPlaybackLoading(false);
      return;
    }
    let cancelled = false;
    setPlayback(null);
    setPlaybackLoading(true);
    setPlaybackError("");
    api<TickerPlayback>(nowPlayingPlaybackPath(selectedTickerId))
      .then((row) => {
        if (cancelled) return;
        setPlayback(row);
        setPlaybackLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setPlayback(null);
        setPlaybackError(NOW_PLAYING_PLAYBACK_ERROR);
        setPlaybackLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTickerId]);

  function onSelectTicker(tickerId: string) {
    writePersistedNowPlayingTickerId(window.localStorage, storageKey, tickerId);
    setSelectedTickerId(tickerId);
  }

  const page = dashboardPageState({ loading, error, data });
  if (page.kind === "loading") {
    return (
      <>
        <h1>Dashboard</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }
  if (page.kind === "error") {
    return (
      <>
        <h1>Dashboard</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="btn" type="button" onClick={load}>
          Try again
        </button>
      </>
    );
  }

  const { view } = page;
  const summary = [
    me?.organization?.name,
    me?.roleKey ? workspaceRoleLabel(me.roleKey) : null,
    view.planStatus ? `plan ${view.planStatus}` : null,
    view.restricted ? "RESTRICTED" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="top">
        <div>
          <h1>Dashboard</h1>
          {summary ? <p className="muted">{summary}</p> : null}
        </div>
      </div>
      <div className="grid stats">
        {view.kpis.map((kpi) => (
          <div className="stat" key={kpi.id}>
            <span className="muted">{kpi.label}</span>
            <strong className={kpi.id === "display-status" ? "stat-text" : undefined}>{kpi.value}</strong>
          </div>
        ))}
      </div>
      <p className="muted dash-note">{view.connectivityNote}</p>
      <section className="dash-now" aria-labelledby="now-playing-heading" aria-busy={playbackLoading}>
        <div className="row dash-now-head">
          <h2 id="now-playing-heading">Now playing</h2>
          {tickers.length > 0 ? (
            <label className="dash-now-select-wrap">
              <span className="sr-only">{NOW_PLAYING_SELECT_LABEL}</span>
              <select
                className="dash-now-select"
                aria-label={NOW_PLAYING_SELECT_LABEL}
                value={selectedTickerId ?? ""}
                onChange={(event) => onSelectTicker(event.target.value)}
              >
                {tickers.map((ticker) => (
                  <option key={ticker.id} value={ticker.id}>
                    {ticker.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {tickers.length === 0 ? (
          <>
            <TickerDisplay
              document={null}
              scale="large"
              label="Now playing"
              emptyMessage={TICKERS_EMPTY_DESCRIPTION}
            />
            <p className="muted dash-now-action">
              <Link to="/tickers">My Tickers</Link>
              {canManageTickers ? (
                <>
                  {" "}
                  · <Link to="/tickers">Add Ticker</Link>
                </>
              ) : null}
            </p>
          </>
        ) : playbackError ? (
          <TickerDisplay document={null} scale="large" label="Now playing" emptyMessage={playbackError} />
        ) : (
          <TickerDisplay
            document={asCompositionDocument(playback?.document)}
            scale="large"
            label="Now playing"
            emptyMessage={playbackLoading ? NOW_PLAYING_LOADING_MESSAGE : NOW_PLAYING_EMPTY}
          />
        )}
      </section>
      <section className="dash-activity" aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading">Recent publishing activity</h2>
        {view.jobs.length === 0 ? (
          <p className="muted">{view.jobsEmptyMessage}</p>
        ) : (
          <>
            <div className="activity-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Status</th>
                    <th scope="col">Trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {view.jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.when}</td>
                      <td>
                        <span className="pill">{job.status}</span>
                      </td>
                      <td>{job.trigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="activity-stack">
              {view.jobs.map((job) => (
                <li key={`stack-${job.id}`}>
                  <article>
                    <h3>{job.status}</h3>
                    <dl>
                      <dt>When</dt>
                      <dd>{job.when}</dd>
                      <dt>Trigger</dt>
                      <dd>{job.trigger}</dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Users() {
  const { canInviteUsers } = useCustomerAccess();
  const [items, setItems] = useState<MembershipRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const canInvite = canInviteUsers;

  async function load(quiet = false) {
    if (!quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const payload = await api<{ items: MembershipRecord[] }>("/v1/memberships");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      if (quiet) {
        setInviteSuccess("");
        setInviteError(USER_INVITE_ERROR);
        return;
      }
      setItems(null);
      setError((err as Error).message?.trim() || "Unable to load your users.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = usersPageState({ loading, error, items });

  async function inviteUser(event: { preventDefault(): void }) {
    event.preventDefault();
    const validated = validateUserInvite({ name, email, password, roleKey: inviteRole });
    if (!validated.ok) {
      setInviteError(validated.message);
      setInviteSuccess("");
      return;
    }
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await api("/v1/memberships", {
        method: "POST",
        body: JSON.stringify(validated.body),
      });
      setName("");
      setEmail("");
      setPassword("");
      setInviteRole("viewer");
      setInviteSuccess(USER_INVITE_SUCCESS);
      await load(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setInviteError(USER_INVITE_ERROR);
    } finally {
      setInviting(false);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Users</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }
  if (page.kind === "error") {
    return (
      <>
        <h1>Users</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="btn" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      <h1>Users</h1>
      <p className="muted">{USERS_PAGE_DESCRIPTION}</p>
      {canInvite ? (
        <form className="card user-add" onSubmit={(event) => void inviteUser(event)}>
          <h2>Add user</h2>
          <div className="user-add__fields">
            <div>
              <label className="pp-field" htmlFor="user-name">
                Full name
              </label>
              <input
                id="user-name"
                className="pp-input"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label className="pp-field" htmlFor="user-email">
                Email
              </label>
              <input
                id="user-email"
                className="pp-input"
                type="email"
                name="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="pp-field" htmlFor="user-password">
                Temporary password
              </label>
              <input
                id="user-password"
                className="pp-input"
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="pp-field" htmlFor="user-role">
                Role
              </label>
              <select
                id="user-role"
                className="pp-input"
                name="roleKey"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              >
                {CUSTOMER_INVITE_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {inviteError ? (
            <p className="error" role="alert">
              {inviteError}
            </p>
          ) : null}
          {inviteSuccess ? (
            <p className="muted" role="status">
              {inviteSuccess}
            </p>
          ) : null}
          <button className="btn" type="submit" disabled={inviting}>
            {userInviteLabel(inviting)}
          </button>
        </form>
      ) : null}
      {page.empty ? (
        <div className="empty-state">
          <h2>{USERS_EMPTY_TITLE}</h2>
          <p className="muted">{USERS_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>{row.roleLabel}</td>
                    <td>
                      <span className="pill">{row.statusLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="stack-list">
            {page.rows.map((row) => (
              <li key={`stack-${row.id}`}>
                <article>
                  <h2>{row.name}</h2>
                  <dl>
                    <dt>Email</dt>
                    <dd>{row.email}</dd>
                    <dt>Role</dt>
                    <dd>{row.roleLabel}</dd>
                    <dt>Status</dt>
                    <dd>
                      <span className="pill">{row.statusLabel}</span>
                    </dd>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Subscription() {
  const { canSimulateSubscription } = useCustomerAccess();
  const [data, setData] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState("");
  const canSimulate = canSimulateSubscription;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<SubscriptionResponse>("/v1/billing/subscription");
      setData(payload);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setData(null);
      setError((err as Error).message?.trim() || "Unable to load your subscription.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = subscriptionPageState({ loading, error, data });

  async function simulate(status: string) {
    setSimulating(status);
    setSimulateError("");
    try {
      await api("/v1/billing/simulate-status", { method: "POST", body: JSON.stringify({ status }) });
      const payload = await api<SubscriptionResponse>("/v1/billing/subscription");
      setData(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSimulateError(SUBSCRIPTION_SIMULATE_ERROR);
    } finally {
      setSimulating(null);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Subscription</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }
  if (page.kind === "error") {
    return (
      <>
        <h1>Subscription</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="btn" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  const { view } = page;
  return (
    <>
      <h1>Subscription</h1>
      <p className="muted">{SUBSCRIPTION_PAGE_DESCRIPTION}</p>
      <p className="muted">{view.note}</p>
      <div className="card">
        <p>
          Status: <strong>{view.statusLabel}</strong>
        </p>
        <p>Restricted: {view.restrictedLabel}</p>
        <p>Current period end: {view.periodLabel}</p>
        {view.limits.map((limit) => (
          <p key={limit.id}>
            {limit.label}: {limit.value}
          </p>
        ))}
      </div>
      {canSimulate ? (
        <section className="card subscription-sim" aria-labelledby="subscription-sim-heading">
          <h2 id="subscription-sim-heading">Simulation (MVP)</h2>
          <p className="muted">{SUBSCRIPTION_SIMULATION_NOTE}</p>
          {simulateError ? (
            <p className="error" role="alert">
              {simulateError}
            </p>
          ) : null}
          <div className="row" style={{ marginTop: 12 }}>
            {SIMULATED_STATUSES.map((status) => (
              <button
                key={status}
                className="btn ghost"
                type="button"
                disabled={Boolean(simulating)}
                onClick={() => void simulate(status)}
              >
                {simulating === status ? "Simulating…" : `Simulate ${status.replaceAll("_", " ")}`}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Audit() {
  const [items, setItems] = useState<AuditRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: AuditRecord[] }>("/v1/audit-logs");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItems(null);
      setError((err as Error).message?.trim() || "Unable to load your audit log.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = auditPageState({ loading, error, items });

  if (page.kind === "loading") {
    return (
      <>
        <h1>Audit</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }
  if (page.kind === "error") {
    return (
      <>
        <h1>Audit</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="btn" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      <h1>Audit</h1>
      <p className="muted">{AUDIT_PAGE_DESCRIPTION}</p>
      {page.empty ? (
        <div className="empty-state">
          <h2>{AUDIT_EMPTY_TITLE}</h2>
          <p className="muted">{AUDIT_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.when}</td>
                    <td>{row.action}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="stack-list">
            {page.rows.map((row) => (
              <li key={`stack-${row.id}`}>
                <article>
                  <h2>{row.action}</h2>
                  <dl>
                    <dt>When</dt>
                    <dd>{row.when}</dd>
                    <dt>Source</dt>
                    <dd>{row.source}</dd>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function ChatDock() {
  const [open, setOpen] = useState(ASSISTANT_DEFAULT_OPEN);
  const [channel, setChannel] = useState<"guide" | "copilot">("guide");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [log, setLog] = useState<{ role: string; content: string }[]>([
    { role: "bot", content: "Ask where something lives, or describe content to create." },
  ]);
  if (!open) {
    return (
      <button type="button" className="pp-btn pp-btn--ghost chat-launch" aria-label="Open assistant" aria-expanded="false" onClick={() => setOpen(true)}>
        Assistant
      </button>
    );
  }
  return (
    <div className="chat-dock" role="dialog" aria-label="Assistant">
      <div className="row chat-dock__bar">
        <strong>Assistant</strong>
        <select value={channel} onChange={(e) => setChannel(e.target.value as "guide" | "copilot")} aria-label="Assistant mode">
          <option value="guide">Guide</option>
          <option value="copilot">Copilot</option>
        </select>
        <button type="button" className="pp-btn pp-btn--ghost" aria-label="Close assistant" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="chat-log">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.content}</div>
        ))}
      </div>
      {chatError ? (
        <p className="error" role="alert">
          {chatError}
        </p>
      ) : null}
      <form
        className="row chat-dock__form"
        onSubmit={async (e) => {
          e.preventDefault();
          const decision = assistantSubmitState(text, sending);
          if (!decision.ok) {
            if (decision.reason === "empty") setChatError(decision.message);
            return;
          }
          const message = decision.message;
          setText("");
          setChatError("");
          setSending(true);
          setLog((l) => [...l, { role: "user", content: message }]);
          try {
            const res = await api<{ reply: string; href?: string }>("/v1/ai/chat", {
              method: "POST",
              body: JSON.stringify({ channel, message, route: location.pathname }),
            });
            setLog((l) => [...l, { role: "bot", content: res.reply }]);
            if (res.href) location.href = res.href;
          } catch (err) {
            if (err instanceof ApiError && err.status === 401) return;
            setChatError(ASSISTANT_SEND_ERROR);
          } finally {
            setSending(false);
          }
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or prompt…" aria-label="Assistant message" />
        <button className="pp-btn pp-btn--primary" type="submit" disabled={sending}>Send</button>
      </form>
    </div>
  );
}
