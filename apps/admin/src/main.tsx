import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

function App() {
  const [token, setTok] = useState(localStorage.getItem("admin_token") ?? "");
  const [email, setEmail] = useState("admin@tickercms.local");
  const [password, setPassword] = useState("Admin@12345");
  const [orgs, setOrgs] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function login(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? "Login failed");
      return;
    }
    localStorage.setItem("admin_token", data.token);
    setTok(data.token);
  }

  useEffect(() => {
    if (!token) return;
    fetch("/v1/admin/organizations", { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrgs(d.items ?? []));
  }, [token]);

  if (!token) {
    return (
      <form onSubmit={login} style={{ maxWidth: 360, margin: 80, fontFamily: "sans-serif" }}>
        <h1>Platform admin</h1>
        <p><input value={email} onChange={(e) => setEmail(e.target.value)} /></p>
        <p><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></p>
        <button type="submit">Login</button>
        {error && <p>{error}</p>}
      </form>
    );
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 32 }}>
      <h1>Organizations</h1>
      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th>Subscription</th><th></th></tr>
        </thead>
        <tbody>
          {orgs.map((o) => (
            <tr key={o.id}>
              <td>{o.name}</td>
              <td>{o.status}</td>
              <td>{o.subscription?.status}</td>
              <td>
                <button
                  onClick={async () => {
                    await fetch(`/v1/admin/organizations/${o.id}/status`, {
                      method: "POST",
                      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status: o.status === "suspended" ? "active" : "suspended" }),
                    });
                    location.reload();
                  }}
                >
                  {o.status === "suspended" ? "Activate" : "Suspend"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
