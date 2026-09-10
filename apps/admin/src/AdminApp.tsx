import { useEffect, useState, type FormEvent } from "react";
import { AppShell, AuthLayout, UnavailablePanel, type ShellNavItem } from "@ticker-cms/ui";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminAssignments } from "./AdminAssignments";
import { AdminDashboard } from "./AdminDashboard";
import { AdminDevices } from "./AdminDevices";
import { AdminDisplayContent } from "./AdminDisplayContent";
import { AdminMonitoring } from "./AdminMonitoring";
import { AdminNotifications } from "./AdminNotifications";
import { AdminPlans } from "./AdminPlans";
import { AdminSettings } from "./AdminSettings";
import { AdminSubscriptions } from "./AdminSubscriptions";
import { AdminSupport } from "./AdminSupport";
import { AdminTemplates } from "./AdminTemplates";
import { AdminUsers } from "./AdminUsers";
import { AdminOrganizationDetail } from "./AdminOrganizationDetail";
import { AdminOrganizations } from "./AdminOrganizations";

const ADMIN_TOKEN_KEY = "admin_token";

type Gate = "login" | "checking" | "admin" | "error";

const ADMIN_NAV: ShellNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", group: "Operations" },
  { id: "organizations", label: "Organizations", icon: "organizations", group: "Operations" },
  { id: "users", label: "Users", icon: "users", group: "Operations" },
  { id: "devices", label: "Displays", icon: "devices", group: "Operations" },
  { id: "monitoring", label: "Monitoring", icon: "monitoring", group: "Operations" },
  { id: "display-content", label: "Display Content", icon: "content", group: "Publishing" },
  { id: "templates", label: "Templates", icon: "templates", group: "Publishing" },
  { id: "assignments", label: "Assignments", icon: "assignments", group: "Publishing" },
  { id: "plans", label: "Plans", icon: "plans", group: "Billing" },
  { id: "subscriptions", label: "Subscriptions", icon: "subscriptions", group: "Billing" },
  { id: "analytics", label: "Analytics", icon: "analytics", group: "Platform" },
  { id: "support", label: "Support", icon: "support", group: "Platform" },
  { id: "notifications", label: "Notifications", icon: "notifications", group: "Platform" },
  { id: "settings", label: "Settings", icon: "settings", group: "Platform" },
  { id: "audit-logs", label: "Audit Logs", icon: "audit", group: "Platform", unavailable: true },
];

function errorMessage(status: number, data: { error?: { message?: string } }, fallback: string) {
  if (data.error?.message) return data.error.message;
  if (status === 401) return "Unauthorized.";
  if (status === 403) return "Forbidden.";
  return fallback;
}

export function AdminApp() {
  const [token, setTok] = useState(localStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [gate, setGate] = useState<Gate>(token ? "checking" : "login");
  const [email, setEmail] = useState("admin@tickercms.local");
  const [password, setPassword] = useState("Admin@12345");
  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [members, setMembers] = useState<any[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [audits, setAudits] = useState<any[] | null>(null);
  const [auditsLoading, setAuditsLoading] = useState(false);
  const [auditsError, setAuditsError] = useState("");
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [deliveries, setDeliveries] = useState<any[] | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState("dashboard");
  const [orgsLoaded, setOrgsLoaded] = useState(false);

  function clearSession(message?: string) {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setTok("");
    setOrgs([]);
    setSelectedOrgId(null);
    setDetail(null);
    setMembers(null);
    setMembersError("");
    setAudits(null);
    setAuditsError("");
    setJobs(null);
    setJobsError("");
    setDeliveries(null);
    setDeliveriesError("");
    setSection("dashboard");
    setOrgsLoaded(false);
    setGate("login");
    if (message) setError(message);
  }

  function logout() {
    clearSession();
    setError("");
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(errorMessage(res.status, data, "Login failed"));
      return;
    }
    if (data.user?.audience !== "platform" || !data.token) {
      setError("Platform admin access required.");
      return;
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setTok(data.token);
    setGate("admin");
  }

  async function handleAdminResponse(res: Response, data: { error?: { message?: string } }, fallback: string) {
    if (res.status === 401) {
      clearSession(errorMessage(res.status, data, "Unauthorized."));
      return false;
    }
    if (res.status === 403) {
      clearSession(errorMessage(res.status, data, "Forbidden."));
      return false;
    }
    if (!res.ok) {
      setError(errorMessage(res.status, data, fallback));
      return false;
    }
    return true;
  }

  async function loadOrganizations(authToken: string) {
    const res = await fetch("/v1/admin/organizations", { headers: { authorization: `Bearer ${authToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!(await handleAdminResponse(res, data, "Could not load organizations."))) return false;
    setOrgs(data.items ?? []);
    setError("");
    return true;
  }

  async function loadDetail(authToken: string, orgId: string) {
    setDetailLoading(true);
    const res = await fetch(`/v1/admin/organizations/${orgId}`, { headers: { authorization: `Bearer ${authToken}` } });
    const data = await res.json().catch(() => ({}));
    setDetailLoading(false);
    if (res.status === 404) {
      setDetail(null);
      setError(errorMessage(res.status, data, "Organization not found."));
      return false;
    }
    if (!(await handleAdminResponse(res, data, "Could not load organization."))) {
      setDetail(null);
      return false;
    }
    setDetail(data);
    setError("");
    return true;
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/v1/me", { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Session expired. Sign in again."));
        return;
      }
      if (!res.ok) {
        setError(errorMessage(res.status, data, "Could not verify session."));
        setGate("error");
        return;
      }
      if (data.user?.audience !== "platform") {
        clearSession("Platform admin access required.");
        return;
      }
      setError("");
      setGate("admin");
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (gate !== "admin" || !token) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/v1/admin/organizations", { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setError(errorMessage(res.status, data, "Could not load organizations."));
        setOrgsLoaded(true);
        return;
      }
      setOrgs(data.items ?? []);
      setError("");
      setOrgsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token]);

  useEffect(() => {
    if (gate !== "admin" || !token || !selectedOrgId) {
      setDetail(null);
      setDetailLoading(false);
      setMembers(null);
      setMembersLoading(false);
      setMembersError("");
      setAudits(null);
      setAuditsLoading(false);
      setAuditsError("");
      setJobs(null);
      setJobsLoading(false);
      setJobsError("");
      setDeliveries(null);
      setDeliveriesLoading(false);
      setDeliveriesError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      const res = await fetch(`/v1/admin/organizations/${selectedOrgId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setDetailLoading(false);
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (res.status === 404) {
        setDetail(null);
        setError(errorMessage(res.status, data, "Organization not found."));
        return;
      }
      if (!res.ok) {
        setDetail(null);
        setError(errorMessage(res.status, data, "Could not load organization."));
        return;
      }
      setDetail(data);
      setError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token, selectedOrgId]);

  useEffect(() => {
    if (gate !== "admin" || !token || !selectedOrgId) return;
    let cancelled = false;
    (async () => {
      setMembers(null);
      setMembersError("");
      setMembersLoading(true);
      const res = await fetch(`/v1/admin/organizations/${selectedOrgId}/memberships`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setMembersLoading(false);
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setMembers(null);
        setMembersError(errorMessage(res.status, data, "Could not load members."));
        return;
      }
      setMembers(Array.isArray(data.items) ? data.items : []);
      setMembersError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token, selectedOrgId]);

  useEffect(() => {
    if (gate !== "admin" || !token || !selectedOrgId) return;
    let cancelled = false;
    (async () => {
      setAudits(null);
      setAuditsError("");
      setAuditsLoading(true);
      const res = await fetch(`/v1/admin/organizations/${selectedOrgId}/audit-logs`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setAuditsLoading(false);
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setAudits(null);
        setAuditsError(errorMessage(res.status, data, "Could not load audit activity."));
        return;
      }
      setAudits(Array.isArray(data.items) ? data.items : []);
      setAuditsError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token, selectedOrgId]);

  useEffect(() => {
    if (gate !== "admin" || !token || !selectedOrgId) return;
    let cancelled = false;
    (async () => {
      setJobs(null);
      setJobsError("");
      setJobsLoading(true);
      const res = await fetch(`/v1/admin/organizations/${selectedOrgId}/publishing-jobs`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setJobsLoading(false);
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setJobs(null);
        setJobsError(errorMessage(res.status, data, "Could not load publishing jobs."));
        return;
      }
      setJobs(Array.isArray(data.items) ? data.items : []);
      setJobsError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token, selectedOrgId]);

  useEffect(() => {
    if (gate !== "admin" || !token || !selectedOrgId) return;
    let cancelled = false;
    (async () => {
      setDeliveries(null);
      setDeliveriesError("");
      setDeliveriesLoading(true);
      const res = await fetch(`/v1/admin/organizations/${selectedOrgId}/deliveries`, {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setDeliveriesLoading(false);
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        clearSession(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setDeliveries(null);
        setDeliveriesError(errorMessage(res.status, data, "Could not load deliveries."));
        return;
      }
      setDeliveries(Array.isArray(data.items) ? data.items : []);
      setDeliveriesError("");
    })();
    return () => {
      cancelled = true;
    };
  }, [gate, token, selectedOrgId]);

  async function toggleStatus(org: { id: string; status: string }) {
    if (statusBusy) return;
    setStatusBusy(true);
    try {
      const res = await fetch(`/v1/admin/organizations/${org.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: org.status === "suspended" ? "active" : "suspended" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        clearSession(errorMessage(res.status, data, "Unauthorized."));
        return;
      }
      if (res.status === 403) {
        setError(errorMessage(res.status, data, "Forbidden."));
        return;
      }
      if (!res.ok) {
        setError(errorMessage(res.status, data, "Could not update organization status."));
        return;
      }
      if (selectedOrgId === org.id) {
        await loadDetail(token, org.id);
        const auditRes = await fetch(`/v1/admin/organizations/${org.id}/audit-logs`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const auditData = await auditRes.json().catch(() => ({}));
        if (auditRes.ok && Array.isArray(auditData.items)) {
          setAudits(auditData.items);
          setAuditsError("");
        }
      }
      await loadOrganizations(token);
    } finally {
      setStatusBusy(false);
    }
  }

  if (gate === "checking") {
    return (
      <AuthLayout productLabel="Photonplay Admin" title="Platform admin">
        <p>Checking session…</p>
      </AuthLayout>
    );
  }

  if (gate === "error") {
    return (
      <AuthLayout productLabel="Photonplay Admin" title="Platform admin">
        {error && <p className="pp-error">{error}</p>}
        <button type="button" className="pp-btn pp-btn--ghost" onClick={logout}>
          Logout
        </button>
      </AuthLayout>
    );
  }

  if (gate !== "admin" || !token) {
    return (
      <AuthLayout productLabel="Photonplay Admin" title="Sign in">
        <form onSubmit={login}>
          <label className="pp-field" htmlFor="admin-email">Email</label>
          <input id="admin-email" className="pp-input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label className="pp-field" htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            className="pp-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="pp-error">{error}</p>}
          <p>
            <button className="pp-btn pp-btn--primary" type="submit">Login</button>
          </p>
        </form>
      </AuthLayout>
    );
  }

  const navItems = ADMIN_NAV.map((item) => ({ ...item, current: item.id === section }));
  const currentNav = ADMIN_NAV.find((item) => item.id === section);
  const org = detail?.organization;
  const headerTitle =
    section === "organizations" && org?.name ? org.name : currentNav?.label ?? "Dashboard";

  return (
    <AppShell
      product="admin"
      brandLabel="Photonplay"
      contextLabel="Operations"
      headerTitle={headerTitle}
      navItems={navItems}
      onLogout={logout}
      onNavSelect={(item) => {
        setError("");
        setSection(item.id);
        if (item.id === "organizations") return;
        setSelectedOrgId(null);
      }}
    >
      {section === "dashboard" && (
        <AdminDashboard
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "devices" && (
        <AdminDevices
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "monitoring" && (
        <AdminMonitoring
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenDevices={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("devices");
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "users" && (
        <AdminUsers
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "assignments" && (
        <AdminAssignments
          onOpenDisplays={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("devices");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenDisplayContent={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("display-content");
          }}
          onOpenMonitoring={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("monitoring");
          }}
        />
      )}
      {section === "templates" && (
        <AdminTemplates
          onOpenDisplayContent={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("display-content");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenMonitoring={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("monitoring");
          }}
        />
      )}
      {section === "display-content" && (
        <AdminDisplayContent
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onOpenTemplates={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("templates");
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "plans" && (
        <AdminPlans
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onOpenSubscriptions={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("subscriptions");
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "settings" && (
        <AdminSettings
          onOpenDashboard={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("dashboard");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenSubscriptions={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("subscriptions");
          }}
          onOpenUsers={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("users");
          }}
        />
      )}
      {section === "notifications" && (
        <AdminNotifications
          onOpenDashboard={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("dashboard");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenDisplays={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("devices");
          }}
          onOpenMonitoring={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("monitoring");
          }}
          onOpenDisplayContent={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("display-content");
          }}
          onOpenSubscriptions={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("subscriptions");
          }}
        />
      )}
      {section === "support" && (
        <AdminSupport
          onOpenDashboard={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("dashboard");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenDisplays={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("devices");
          }}
          onOpenMonitoring={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("monitoring");
          }}
          onOpenDisplayContent={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("display-content");
          }}
          onOpenSubscriptions={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("subscriptions");
          }}
          onOpenUsers={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("users");
          }}
        />
      )}
      {section === "analytics" && (
        <AdminAnalytics
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenDashboard={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("dashboard");
          }}
          onOpenMonitoring={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("monitoring");
          }}
          onOpenDisplayContent={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("display-content");
          }}
          onOpenOrganizations={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("organizations");
          }}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onOpenDisplays={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("devices");
          }}
          onOpenSubscriptions={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("subscriptions");
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section === "subscriptions" && (
        <AdminSubscriptions
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          onOpenOrganization={(id) => {
            setError("");
            setSection("organizations");
            setSelectedOrgId(id);
          }}
          onOpenPlans={() => {
            setError("");
            setSelectedOrgId(null);
            setSection("plans");
          }}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
      {section !== "dashboard" &&
        section !== "organizations" &&
        section !== "devices" &&
        section !== "monitoring" &&
        section !== "users" &&
        section !== "assignments" &&
        section !== "templates" &&
        section !== "display-content" &&
        section !== "plans" &&
        section !== "subscriptions" &&
        section !== "analytics" &&
        section !== "support" &&
        section !== "notifications" &&
        section !== "settings" && <UnavailablePanel title={currentNav?.label ?? "Section"} />}
      {section === "organizations" && selectedOrgId && (
        <AdminOrganizationDetail
          error={error}
          detail={detail}
          detailLoading={detailLoading}
          statusBusy={statusBusy}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          audits={audits}
          auditsLoading={auditsLoading}
          auditsError={auditsError}
          jobs={jobs}
          jobsLoading={jobsLoading}
          jobsError={jobsError}
          deliveries={deliveries}
          deliveriesLoading={deliveriesLoading}
          deliveriesError={deliveriesError}
          onBack={() => {
            setSelectedOrgId(null);
            setDetail(null);
            setError("");
          }}
          onToggleStatus={toggleStatus}
        />
      )}
      {section === "organizations" && !selectedOrgId && (
        <AdminOrganizations
          token={token}
          orgs={orgs}
          listError={error}
          listReady={orgsLoaded}
          statusBusy={statusBusy}
          onOpenOrganization={(id) => {
            setError("");
            setSelectedOrgId(id);
          }}
          onToggleStatus={toggleStatus}
          onAuthFailure={(status, data, fallback) => {
            if (status === 401 || status === 403) {
              clearSession(errorMessage(status, data, fallback));
              return true;
            }
            return false;
          }}
        />
      )}
    </AppShell>
  );
}
