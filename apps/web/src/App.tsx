import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { CompositionDocument } from "@ticker-cms/composition";
import { api, setToken, token } from "./api";
import { LedPreview } from "./LedPreview";

type Me = {
  user: { id: string; email: string; name: string; audience: string };
  organization: { id: string; name: string; status: string } | null;
  roleKey: string;
};

function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!token()) return;
    api<Me>("/v1/me")
      .then(setMe)
      .catch((e) => setErr(e.message));
  }, []);
  return { me, err, setMe };
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={<Authed />} />
    </Routes>
  );
}

function Authed() {
  if (!token()) return <Navigate to="/login" replace />;
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">TICKER CMS</div>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Dashboard</NavLink>
        <NavLink to="/tickers" className={({ isActive }) => (isActive ? "active" : "")}>Tickers</NavLink>
        <NavLink to="/content" className={({ isActive }) => (isActive ? "active" : "")}>Content</NavLink>
        <NavLink to="/templates" className={({ isActive }) => (isActive ? "active" : "")}>Templates</NavLink>
        <NavLink to="/animations" className={({ isActive }) => (isActive ? "active" : "")}>Animations</NavLink>
        <NavLink to="/campaigns" className={({ isActive }) => (isActive ? "active" : "")}>Campaigns</NavLink>
        <NavLink to="/assets" className={({ isActive }) => (isActive ? "active" : "")}>Assets</NavLink>
        <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>Users</NavLink>
        <NavLink to="/account/subscription" className={({ isActive }) => (isActive ? "active" : "")}>Subscription</NavLink>
        <NavLink to="/audit" className={({ isActive }) => (isActive ? "active" : "")}>Audit</NavLink>
      </nav>
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickers" element={<Tickers />} />
          <Route path="/tickers/:id" element={<TickerDetail />} />
          <Route path="/content" element={<ContentList />} />
          <Route path="/content/:id/edit" element={<Editor />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/animations" element={<Animations />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/users" element={<Users />} />
          <Route path="/account/subscription" element={<Subscription />} />
          <Route path="/audit" element={<Audit />} />
        </Routes>
        <ChatDock />
      </div>
    </div>
  );
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("owner@demo.local");
  const [password, setPassword] = useState("Demo@12345");
  const [error, setError] = useState("");
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <h1>See the ticker before it goes live.</h1>
        <p>Subscription-enforced LED content, campaigns, and pixel-true preview — not a cloned control room.</p>
      </div>
      <div className="auth-card">
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await api<{ token: string }>("/v1/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password }),
              });
              setToken(res.token);
              nav("/");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <h2>Sign in</h2>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" type="submit">Login</button>
            <Link to="/register">Create organization</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", name: "", organizationName: "" });
  const [error, setError] = useState("");
  return (
    <div className="auth-card" style={{ minHeight: "100vh" }}>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const res = await api<{ token: string }>("/v1/auth/register", { method: "POST", body: JSON.stringify(form) });
            setToken(res.token);
            nav("/");
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <h2>New organization</h2>
        {(["name", "email", "password", "organizationName"] as const).map((k) => (
          <div key={k}>
            <label>{k}</label>
            <input
              type={k === "password" ? "password" : "text"}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        <button className="btn" style={{ marginTop: 16 }} type="submit">Create</button>
      </form>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState<any>(null);
  const { me } = useMe();
  useEffect(() => {
    api("/v1/dashboard").then(setData).catch(() => setData(null));
  }, []);
  if (!data) return <p className="muted">Loading dashboard…</p>;
  return (
    <>
      <div className="top">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            {me?.organization?.name} · {me?.roleKey} · plan {data.entitlements?.status}
            {data.entitlements?.restricted ? " · RESTRICTED" : ""}
          </p>
        </div>
        <button className="btn ghost" onClick={() => { setToken(null); location.href = "/login"; }}>
          Logout
        </button>
      </div>
      <div className="grid stats">
        <div className="stat"><span className="muted">Tickers</span><b>{data.totals.tickers}</b></div>
        <div className="stat"><span className="muted">Online</span><b>{data.totals.online}</b></div>
        <div className="stat"><span className="muted">Offline</span><b>{data.totals.offline}</b></div>
        <div className="stat"><span className="muted">Campaigns</span><b>{data.totals.campaigns}</b></div>
      </div>
      <div className="led-wrap" style={{ marginTop: 20 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <strong>Now playing</strong>
          <span className="muted">{data.preview?.source} {data.preview?.campaignName ?? ""}</span>
        </div>
        <LedPreview document={data.preview?.document} />
      </div>
    </>
  );
}

function Tickers() {
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("Lobby ticker");
  const [error, setError] = useState("");
  const load = () => api<{ items: any[] }>("/v1/tickers").then((r) => setItems(r.items));
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="top">
        <h1>Tickers</h1>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/v1/tickers", { method: "POST", body: JSON.stringify({ name, width: 993, height: 32 }) });
              setError("");
              load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" type="submit">Add ticker</button>
        </form>
      </div>
      {error && <p className="error">{error}</p>}
      <table className="table">
        <thead><tr><th>Name</th><th>Matrix</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td><Link to={`/tickers/${t.id}`}>{t.name}</Link></td>
              <td>{t.width}×{t.height}</td>
              <td><span className={`pill ${t.online ? "on" : "off"}`}>{t.online ? "online" : "offline"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function TickerDetail() {
  const { id } = useParams();
  const [row, setRow] = useState<any>(null);
  useEffect(() => {
    api(`/v1/tickers/${id}`).then(setRow);
  }, [id]);
  if (!row) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>{row.name}</h1>
      <p className="muted">{row.location || "No location"} · {row.width}×{row.height}</p>
      <div className="row">
        <button
          className="btn ghost"
          onClick={async () => {
            await api(`/v1/tickers/${id}/heartbeat`, { method: "POST" });
            setRow(await api(`/v1/tickers/${id}`));
          }}
        >
          Simulate heartbeat
        </button>
      </div>
      <div className="led-wrap" style={{ marginTop: 16 }}>
        <LedPreview document={row.nowPlaying?.document} />
      </div>
    </>
  );
}

function ContentList() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api<{ items: any[] }>("/v1/contents").then((r) => setItems(r.items));
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="top">
        <h1>Content</h1>
        <button
          className="btn"
          onClick={async () => {
            const created = await api<{ id: string }>("/v1/contents", {
              method: "POST",
              body: JSON.stringify({ title: "New ticker message", templateId: "tpl_blank" }),
            });
            location.href = `/content/${created.id}/edit`;
          }}
        >
          New content
        </button>
      </div>
      <table className="table">
        <thead><tr><th>Title</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/content/${c.id}/edit`}>{c.title}</Link></td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Editor() {
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<CompositionDocument | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    api<any>(`/v1/contents/${id}`).then((r) => {
      setTitle(r.title);
      setDoc(r.document);
    });
  }, [id]);
  const textLayer = doc?.layers.find((l) => l.type === "text");
  const fill = doc?.layers.find((l) => l.type === "fill");
  return (
    <>
      <div className="top">
        <h1>Editor</h1>
        <div className="row">
          <button
            className="btn ghost"
            onClick={async () => {
              await api(`/v1/contents/${id}`, { method: "PATCH", body: JSON.stringify({ title, document: doc }) });
              setMsg("Draft saved");
            }}
          >
            Save draft
          </button>
          <button
            className="btn"
            onClick={async () => {
              try {
                await api(`/v1/contents/${id}/publish`, { method: "POST" });
                setMsg("Published to assigned tickers");
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            Publish
          </button>
        </div>
      </div>
      {msg && <p className="muted">{msg}</p>}
      <div className="editor">
        <div className="led-wrap"><LedPreview document={doc} /></div>
        <div className="card">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          <label>Headline</label>
          <textarea
            rows={4}
            value={textLayer && textLayer.type === "text" ? textLayer.props.text : ""}
            onChange={(e) => {
              if (!doc) return;
              setDoc({
                ...doc,
                layers: doc.layers.map((l) =>
                  l.type === "text" ? { ...l, props: { ...l.props, text: e.target.value } } : l,
                ),
              });
            }}
          />
          <label>Background</label>
          <input
            value={fill && fill.type === "fill" ? fill.props.color : "#050705"}
            onChange={(e) => {
              if (!doc) return;
              setDoc({
                ...doc,
                layers: doc.layers.map((l) =>
                  l.type === "fill" ? { ...l, props: { color: e.target.value } } : l,
                ),
              });
            }}
          />
        </div>
      </div>
    </>
  );
}

function Templates() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api<{ items: any[] }>("/v1/templates").then((r) => setItems(r.items));
  }, []);
  return (
    <>
      <h1>Templates</h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {items.map((t) => (
          <div className="card" key={t.id}>
            <strong>{t.title}</strong>
            <p className="muted">{t.category}</p>
            <LedPreview document={t.document} />
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={async () => {
                const created = await api<{ id: string }>("/v1/contents", {
                  method: "POST",
                  body: JSON.stringify({ title: t.title, templateId: t.id }),
                });
                location.href = `/content/${created.id}/edit`;
              }}
            >
              Use template
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function Animations() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api<{ items: any[] }>("/v1/animation-packs").then((r) => setItems(r.items));
  }, []);
  return (
    <>
      <h1>Animation packs</h1>
      <p className="muted">New packs are catalog data — no app deploy required.</p>
      <table className="table">
        <thead><tr><th>Pack</th><th>Category</th><th>Access</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.category}</td>
              <td>{p.entitled ? "included" : "plan locked"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Campaigns() {
  const [items, setItems] = useState<any[]>([]);
  const [contents, setContents] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "Diwali Promotion", contentId: "", priority: 100 });
  const load = () => api<{ items: any[] }>("/v1/campaigns").then((r) => setItems(r.items));
  useEffect(() => {
    load();
    api<{ items: any[] }>("/v1/contents").then((r) => {
      setContents(r.items);
      if (r.items[0]) setForm((f) => ({ ...f, contentId: r.items[0].id }));
    });
  }, []);
  const start = useMemo(() => new Date().toISOString().slice(0, 16), []);
  const end = useMemo(() => new Date(Date.now() + 86400000 * 16).toISOString().slice(0, 16), []);
  return (
    <>
      <h1>Campaigns</h1>
      <form
        className="card"
        style={{ marginBottom: 16 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await api("/v1/campaigns", {
            method: "POST",
            body: JSON.stringify({
              ...form,
              startAt: new Date(String(fd.get("startAt"))).toISOString(),
              endAt: new Date(String(fd.get("endAt"))).toISOString(),
            }),
          });
          load();
        }}
      >
        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label>Content</label>
        <select value={form.contentId} onChange={(e) => setForm({ ...form, contentId: e.target.value })}>
          {contents.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <label>Priority (higher wins)</label>
        <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
        <label>Start</label>
        <input type="datetime-local" name="startAt" defaultValue={start} />
        <label>End</label>
        <input type="datetime-local" name="endAt" defaultValue={end} />
        <button className="btn" style={{ marginTop: 12 }} type="submit">Schedule</button>
      </form>
      <table className="table">
        <thead><tr><th>Name</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.priority}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Assets() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api<{ items: any[] }>("/v1/assets").then((r) => setItems(r.items));
  }, []);
  return (
    <>
      <h1>Assets</h1>
      <table className="table">
        <thead><tr><th>Name</th><th>Kind</th><th>Status</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}><td>{a.name}</td><td>{a.kind}</td><td>{a.status}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Users() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api<{ items: any[] }>("/v1/memberships").then((r) => setItems(r.items));
  useEffect(() => { load(); }, []);
  return (
    <>
      <h1>Users</h1>
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          await api("/v1/memberships", {
            method: "POST",
            body: JSON.stringify({
              email: fd.get("email"),
              name: fd.get("name"),
              password: fd.get("password"),
              roleKey: fd.get("roleKey"),
            }),
          });
          load();
        }}
      >
        <div className="row">
          <input name="name" placeholder="Name" required />
          <input name="email" placeholder="Email" required />
          <input name="password" placeholder="Temp password" required />
          <select name="roleKey" defaultValue="viewer">
            <option>viewer</option>
            <option>operator</option>
            <option>designer</option>
            <option>content_manager</option>
            <option>organization_admin</option>
          </select>
          <button className="btn" type="submit">Invite</button>
        </div>
      </form>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td>{m.roleKey}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Subscription() {
  const [data, setData] = useState<any>(null);
  const load = () => api("/v1/billing/subscription").then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return null;
  return (
    <>
      <h1>Subscription</h1>
      <p className="muted">{data.note}</p>
      <div className="card">
        <p>Status: <strong>{data.entitlements.status}</strong></p>
        <p>Restricted: {String(data.entitlements.restricted)}</p>
        <p>Devices remaining: {data.entitlements.remaining.devices}</p>
        <div className="row" style={{ marginTop: 12 }}>
          {["active", "past_due", "expired", "cancelled", "suspended"].map((s) => (
            <button
              key={s}
              className="btn ghost"
              onClick={async () => {
                await api("/v1/billing/simulate-status", { method: "POST", body: JSON.stringify({ status: s }) });
                load();
              }}
            >
              Simulate {s}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function Audit() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api<{ items: any[] }>("/v1/audit-logs").then((r) => setItems(r.items));
  }, []);
  return (
    <>
      <h1>Audit log</h1>
      <table className="table">
        <thead><tr><th>When</th><th>Action</th><th>Source</th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
              <td>{a.action}</td>
              <td>{a.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ChatDock() {
  const [open, setOpen] = useState(true);
  const [channel, setChannel] = useState<"guide" | "copilot">("guide");
  const [text, setText] = useState("");
  const [log, setLog] = useState<{ role: string; content: string }[]>([
    { role: "bot", content: "Ask where something lives, or describe content to create." },
  ]);
  if (!open) {
    return (
      <button className="btn" style={{ position: "fixed", right: 18, bottom: 18 }} onClick={() => setOpen(true)}>
        Assistant
      </button>
    );
  }
  return (
    <div className="chat-dock">
      <div className="row" style={{ padding: 10, justifyContent: "space-between" }}>
        <strong>Assistant</strong>
        <select value={channel} onChange={(e) => setChannel(e.target.value as "guide" | "copilot")}>
          <option value="guide">Guide</option>
          <option value="copilot">Copilot</option>
        </select>
        <button className="btn ghost" onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="chat-log">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.content}</div>
        ))}
      </div>
      <form
        className="row"
        style={{ padding: 10 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const message = text;
          setText("");
          setLog((l) => [...l, { role: "user", content: message }]);
          const res = await api<{ reply: string; href?: string }>("/v1/ai/chat", {
            method: "POST",
            body: JSON.stringify({ channel, message, route: location.pathname }),
          });
          setLog((l) => [...l, { role: "bot", content: res.reply }]);
          if (res.href) location.href = res.href;
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or prompt…" />
        <button className="btn" type="submit">Send</button>
      </form>
    </div>
  );
}
