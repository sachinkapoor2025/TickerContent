import { useEffect, useState } from "react";
import type { AdminOrgDetail, AdminOrgListItem } from "./dashboardData";
import type { AdminDeliveryItem, AdminJobItem } from "./opsData";

type AuthHandler = (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;

type UseAdminFleetDataArgs = {
  token: string;
  orgs: AdminOrgListItem[];
  listReady: boolean;
  listError: string;
  onAuthFailure: AuthHandler;
};

export function useAdminFleetData({ token, orgs, listReady, listError, onAuthFailure }: UseAdminFleetDataArgs) {
  const [details, setDetails] = useState<Record<string, AdminOrgDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const [deliveriesByOrg, setDeliveriesByOrg] = useState<Record<string, AdminDeliveryItem[]> | null>(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [deliveriesError, setDeliveriesError] = useState("");
  const [jobsByOrg, setJobsByOrg] = useState<Record<string, AdminJobItem[]> | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState("");

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setDetails({});
        setDetailsError("");
        setDetailsLoading(false);
        setDeliveriesByOrg(listError ? null : {});
        setDeliveriesError("");
        setDeliveriesLoading(false);
        setJobsByOrg(listError ? null : {});
        setJobsError("");
        setJobsLoading(false);
        return;
      }

      setDetailsLoading(true);
      setDeliveriesLoading(true);
      setJobsLoading(true);
      setDetailsError("");
      setDeliveriesError("");
      setJobsError("");

      const nextDetails: Record<string, AdminOrgDetail> = {};
      let detailFailed = false;
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
            detailFailed = true;
            return;
          }
          nextDetails[org.id] = data as AdminOrgDetail;
        }),
      );
      if (cancelled) return;
      setDetails(nextDetails);
      setDetailsLoading(false);
      if (detailFailed) setDetailsError("Some organization details could not be loaded.");

      const nextDeliveries: Record<string, AdminDeliveryItem[]> = {};
      let deliveryFailed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}/deliveries`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load deliveries.");
            return;
          }
          if (!res.ok) {
            deliveryFailed = true;
            return;
          }
          nextDeliveries[org.id] = Array.isArray(data.items) ? data.items : [];
        }),
      );
      if (cancelled) return;
      setDeliveriesLoading(false);
      if (deliveryFailed) {
        setDeliveriesByOrg(null);
        setDeliveriesError("Could not load delivery records.");
      } else {
        setDeliveriesByOrg(nextDeliveries);
        setDeliveriesError("");
      }

      const nextJobs: Record<string, AdminJobItem[]> = {};
      let jobFailed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}/publishing-jobs`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load publishing jobs.");
            return;
          }
          if (!res.ok) {
            jobFailed = true;
            return;
          }
          nextJobs[org.id] = Array.isArray(data.items) ? data.items : [];
        }),
      );
      if (cancelled) return;
      setJobsLoading(false);
      if (jobFailed) {
        setJobsByOrg(null);
        setJobsError("Could not load publishing jobs.");
      } else {
        setJobsByOrg(nextJobs);
        setJobsError("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgs, listError, listReady]);

  return {
    details,
    detailsLoading,
    detailsError,
    deliveriesByOrg,
    deliveriesLoading,
    deliveriesError,
    jobsByOrg,
    jobsLoading,
    jobsError,
  };
}
