export type AssignmentAvailability = "not_available" | "tenant_only";

export type AssignmentSurface = {
  id: string;
  label: string;
  summary: string;
};

export type AssignmentTopic = {
  id: string;
  topic: string;
  availability: AssignmentAvailability;
  evidence: string;
};

export type AssignmentFlowStep = {
  id: string;
  title: string;
  note: string;
};

export const LIVE_ASSIGNMENT_SECTIONS = ["organizations", "devices", "display-content", "monitoring"] as const;

export const ASSIGNMENT_CAPABILITIES: AssignmentTopic[] = [
  {
    id: "admin-api",
    topic: "Platform assignment API",
    availability: "not_available",
    evidence: "There is no Admin API to create, edit, prioritize, or history-track display assignments.",
  },
  {
    id: "campaign-targeting",
    topic: "Campaign targeting",
    availability: "tenant_only",
    evidence: "Tenant campaigns select ticker IDs. Playback prefers an in-window targeted campaign.",
  },
  {
    id: "device-groups",
    topic: "Device groups",
    availability: "tenant_only",
    evidence: "Tenant can create named ticker ID lists. Playback does not use them.",
  },
  {
    id: "playlists",
    topic: "Playlists / default assignment",
    availability: "not_available",
    evidence: "Playlist rows exist. Tickers store assignedPlaylistId as unused null on create.",
  },
];

export const ASSIGNMENT_SURFACES: AssignmentSurface[] = [
  {
    id: "organizations",
    label: "Organizations",
    summary: "Organization record, publishing jobs, deliveries, and per-organization audit. Not an assignment manager.",
  },
  {
    id: "devices",
    label: "Displays",
    summary: "Registered ticker counts and delivery records known to Admin APIs.",
  },
  {
    id: "display-content",
    label: "Display Content",
    summary: "Published versions inferred from publishing jobs and deliveries.",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    summary: "Current publishing job and delivery status. These are records, not assignments.",
  },
];

export const ASSIGNMENT_FLOW: AssignmentFlowStep[] = [
  {
    id: "organization",
    title: "Organization",
    note: "Tenant owns users, tickers, campaigns, and publish operations.",
  },
  {
    id: "targeting",
    title: "Tenant campaign targeting",
    note: "Campaigns select ticker IDs in the customer workspace. Admin cannot edit targeting.",
  },
  {
    id: "content",
    title: "Published content / version",
    note: "Publish uses an immutable content version snapshot.",
  },
  {
    id: "job",
    title: "Publishing job",
    note: "Admin can inspect job status on Monitoring and Organization detail.",
  },
  {
    id: "delivery",
    title: "Display delivery",
    note: "A delivery record is evidence a snapshot was sent to a ticker ID. It is not an assignment entity.",
  },
];

export function assignmentAvailabilityLabel(availability: AssignmentAvailability) {
  if (availability === "tenant_only") return "Tenant-only";
  return "Not available";
}

export function assignmentAvailabilityTone(availability: AssignmentAvailability) {
  return availability === "tenant_only" ? "info" : "neutral";
}

export function assignmentSurfaceIds(surfaces = ASSIGNMENT_SURFACES) {
  return surfaces.map((surface) => surface.id);
}

export function assignmentFlowIds(steps = ASSIGNMENT_FLOW) {
  return steps.map((step) => step.id);
}

export function findAssignmentTopic(id: string, topics = ASSIGNMENT_CAPABILITIES) {
  return topics.find((topic) => topic.id === id) ?? null;
}
