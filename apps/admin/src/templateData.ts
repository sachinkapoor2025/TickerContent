export type TemplateAvailability = "not_available" | "tenant_only";

export type TemplateSurface = {
  id: string;
  label: string;
  summary: string;
};

export type TemplateTopic = {
  id: string;
  topic: string;
  availability: TemplateAvailability;
  evidence: string;
};

export const LIVE_TEMPLATE_SECTIONS = ["organizations", "display-content", "monitoring"] as const;

export const TEMPLATE_CAPABILITIES: TemplateTopic[] = [
  {
    id: "catalog",
    topic: "Global template catalog",
    availability: "not_available",
    evidence: "There is no /v1/admin templates list. Tenant GET /v1/templates is not used here.",
  },
  {
    id: "crud",
    topic: "Template CRUD from Admin",
    availability: "not_available",
    evidence: "Admin cannot create, edit, or delete template records.",
  },
  {
    id: "publish",
    topic: "Platform template publishing",
    availability: "not_available",
    evidence: "Templates are starting points for tenant content. They are not published from Admin.",
  },
  {
    id: "document",
    topic: "Template composition JSON",
    availability: "tenant_only",
    evidence: "Ownership, category, visibility, and document live in the tenant catalog.",
  },
];

export const TEMPLATE_SURFACES: TemplateSurface[] = [
  {
    id: "organizations",
    label: "Organizations",
    summary: "Organization status, members, publishing jobs, deliveries, and per-organization audit records.",
  },
  {
    id: "display-content",
    label: "Display Content",
    summary: "Published versions inferred from Admin publishing jobs and deliveries. Not a template catalog.",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    summary: "Current publishing job and delivery status. These are records, not templates.",
  },
];

export function templateAvailabilityLabel(availability: TemplateAvailability) {
  if (availability === "tenant_only") return "Tenant-only";
  return "Not available";
}

export function templateAvailabilityTone(availability: TemplateAvailability) {
  return availability === "tenant_only" ? "info" : "neutral";
}

export function templateSurfaceIds(surfaces = TEMPLATE_SURFACES) {
  return surfaces.map((surface) => surface.id);
}

export function findTemplateTopic(id: string, topics = TEMPLATE_CAPABILITIES) {
  return topics.find((topic) => topic.id === id) ?? null;
}
