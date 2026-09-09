import { useEffect, useState } from "react";
import type { AdminOrgDetail, AdminOrgListItem } from "./dashboardData";

type AuthHandler = (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;

type Args = {
  token: string;
  orgs: AdminOrgListItem[];
  listReady: boolean;
  listError: string;
  onAuthFailure: AuthHandler;
};

export function useAdminOrgDetails({ token, orgs, listReady, listError, onAuthFailure }: Args) {
  const [details, setDetails] = useState<Record<string, AdminOrgDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setDetails({});
        setError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const next: Record<string, AdminOrgDetail> = {};
      let failed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load organization.");
            return;
          }
          if (!res.ok) {
            failed = true;
            return;
          }
          next[org.id] = data as AdminOrgDetail;
        }),
      );
      if (cancelled) return;
      setDetails(next);
      setLoading(false);
      if (failed) setError("Some organization details could not be loaded.");
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgs, listReady, listError]);

  return { details, loading, error };
}
