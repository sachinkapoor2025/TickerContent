import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import {
  CONTENTS_EMPTY_DESCRIPTION,
  CONTENTS_EMPTY_TITLE,
  CONTENTS_ERROR_MESSAGE,
  CONTENTS_LOADING_MESSAGE,
  CONTENTS_PAGE_DESCRIPTION,
  CONTENT_CREATE_ERROR,
  CONTENT_DETAIL_ERROR_MESSAGE,
  CONTENT_DETAIL_LOADING_MESSAGE,
  CONTENT_NAME_REQUIRED,
  CONTENT_NOT_PUBLISHED_LABEL,
  CONTENT_PUBLISHED_LABEL,
  CONTENT_STACK_MAX_PX,
  contentCreateBody,
  contentDetailPageState,
  contentEditorHref,
  contentListRows,
  contentPublishedLabel,
  contentStatusLabel,
  contentSubmitLabel,
  contentsPageState,
  createdContentHref,
  formatContentTimestamp,
  needsContentStackList,
  validateContentName,
  type ContentRecord,
} from "./contentData.js";

const draft: ContentRecord = {
  id: "cnt_1",
  organizationId: "org_other",
  title: "Lobby welcome",
  status: "draft",
  headDraftVersionId: "ver_1",
  publishedVersionId: null,
};

const published: ContentRecord = {
  id: "cnt_2",
  title: "Concourse promo",
  status: "published",
  headDraftVersionId: "ver_4",
  publishedVersionId: "ver_3",
  versions: [
    { id: "ver_3", createdAt: "2026-09-01T12:00:00.000Z", createdBy: "usr_secret" },
    { id: "ver_4", createdAt: "2026-09-02T15:30:00.000Z", createdBy: "usr_secret" },
    { id: "ver_2", createdAt: "2026-08-20T09:00:00.000Z" },
  ],
};

describe("content library copy", () => {
  it("describes a content-management workspace without analytics claims", () => {
    expect(CONTENTS_PAGE_DESCRIPTION).toBe("Create and manage the content used on your displays.");
    expect(CONTENTS_PAGE_DESCRIPTION).not.toMatch(/online|offline|impressions|analytics/i);
    expect(CONTENTS_EMPTY_TITLE).toBe("No content yet");
    expect(CONTENTS_EMPTY_DESCRIPTION).toBe("Create content to start designing messages for your displays.");
  });
});

describe("content list mapping", () => {
  it("maps real records using title as the customer-facing name", () => {
    const rows = contentListRows([draft, published]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "cnt_1",
      name: "Lobby welcome",
      href: "/content/cnt_1",
      editorHref: "/content/cnt_1/edit",
      statusLabel: "Draft",
      publishedLabel: CONTENT_NOT_PUBLISHED_LABEL,
    });
    expect(rows[1]).toMatchObject({
      name: "Concourse promo",
      statusLabel: "Published",
      publishedLabel: CONTENT_PUBLISHED_LABEL,
    });
    expect(JSON.stringify(rows)).not.toMatch(/org_other|organizationId|usr_secret/);
    expect(rows.some((row) => row.name.startsWith("cnt_"))).toBe(false);
  });

  it("shows an empty list after a successful load with zero records", () => {
    const page = contentsPageState({ loading: false, error: null, items: [] });
    expect(page).toEqual({ kind: "ready", total: 0, empty: true, rows: [] });
  });

  it("keeps loading distinct from an empty list", () => {
    expect(contentsPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: CONTENTS_LOADING_MESSAGE,
    });
  });

  it("surfaces an API error instead of fake rows", () => {
    expect(contentsPageState({ loading: false, error: "Request failed.", items: null })).toEqual({
      kind: "error",
      message: "Request failed.",
    });
    expect(contentsPageState({ loading: false, error: null, items: null })).toMatchObject({
      kind: "error",
      message: CONTENTS_ERROR_MESSAGE,
    });
  });
});

describe("create content", () => {
  it("requires a content name", () => {
    expect(validateContentName("   ")).toEqual({ ok: false, message: CONTENT_NAME_REQUIRED });
    expect(validateContentName("")).toEqual({ ok: false, message: CONTENT_NAME_REQUIRED });
  });

  it("builds a create payload from the supported title field only", () => {
    const validated = validateContentName("  Lobby welcome  ");
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(contentCreateBody(validated.title)).toEqual({ title: "Lobby welcome" });
    expect(createdContentHref("cnt_new")).toBe("/content/cnt_new");
  });

  it("uses a submitting label while create is in progress", () => {
    expect(contentSubmitLabel(false)).toBe("Create content");
    expect(contentSubmitLabel(true)).toBe("Creating…");
  });

  it("uses a generic create failure message when the API does not succeed", () => {
    expect(CONTENT_CREATE_ERROR).toBe("Unable to create content.");
  });

  it("opens the created content on success using the returned id", () => {
    const created = { id: "cnt_new", title: "Lobby welcome", status: "draft", versionId: "ver_1" };
    expect(createdContentHref(created.id)).toBe("/content/cnt_new");
  });
});

describe("published and status representation", () => {
  it("maps real API statuses without inventing connectivity", () => {
    expect(contentStatusLabel("draft")).toBe("Draft");
    expect(contentStatusLabel("published")).toBe("Published");
    expect(contentStatusLabel("draft")).not.toMatch(/online|offline/i);
    expect(contentPublishedLabel(null)).toBe(CONTENT_NOT_PUBLISHED_LABEL);
    expect(contentPublishedLabel("ver_3")).toBe(CONTENT_PUBLISHED_LABEL);
  });

  it("does not treat a saved draft as published", () => {
    const rows = contentListRows([draft]);
    expect(rows[0]?.statusLabel).toBe("Draft");
    expect(rows[0]?.publishedLabel).toBe(CONTENT_NOT_PUBLISHED_LABEL);
  });
});

describe("content detail", () => {
  it("shows loading and error states without fake preview content", () => {
    expect(contentDetailPageState({ loading: true, error: null, row: null })).toEqual({
      kind: "loading",
      message: CONTENT_DETAIL_LOADING_MESSAGE,
    });
    const failed = contentDetailPageState({ loading: false, error: null, row: null });
    expect(failed).toEqual({ kind: "error", message: CONTENT_DETAIL_ERROR_MESSAGE });
    expect(JSON.stringify(failed)).not.toMatch(/your message here/i);
  });

  it("shows identity, saved state, published state, and editor entry", () => {
    const page = contentDetailPageState({ loading: false, error: null, row: published });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.name).toBe("Concourse promo");
    expect(page.view.statusLabel).toBe("Published");
    expect(page.view.publishedLabel).toBe(CONTENT_PUBLISHED_LABEL);
    expect(page.view.editorHref).toBe("/content/cnt_2/edit");
    expect(contentEditorHref(page.view.id)).toBe("/content/cnt_2/edit");
    expect(JSON.stringify(page.view)).not.toMatch(/organizationId|usr_secret|layers/);
  });

  it("shows version history from the detail payload without inventing versions", () => {
    const page = contentDetailPageState({ loading: false, error: null, row: published });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.versions.map((version) => version.id)).toEqual(["ver_4", "ver_3", "ver_2"]);
    expect(page.view.versions[0]).toMatchObject({
      id: "ver_4",
      statusLabel: "Draft",
      currentDraft: true,
      published: false,
      editorHref: "/content/cnt_2/edit",
    });
    expect(page.view.versions[1]).toMatchObject({
      id: "ver_3",
      statusLabel: CONTENT_PUBLISHED_LABEL,
      published: true,
      currentDraft: false,
      editorHref: null,
    });
    expect(page.view.versions[2]).toMatchObject({
      id: "ver_2",
      statusLabel: CONTENT_NOT_PUBLISHED_LABEL,
      editorHref: null,
    });
    expect(page.view.versions[0]?.createdLabel).not.toBe("—");
    expect(formatContentTimestamp(null)).toBe("—");
  });

  it("keeps a published snapshot distinguishable from the current draft", () => {
    const page = contentDetailPageState({ loading: false, error: null, row: published });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    const draftVersion = page.view.versions.find((version) => version.currentDraft);
    const publishedVersion = page.view.versions.find((version) => version.published);
    expect(draftVersion?.id).toBe("ver_4");
    expect(publishedVersion?.id).toBe("ver_3");
    expect(draftVersion?.id).not.toBe(publishedVersion?.id);
  });

  it("does not interpret content status as Online or Offline", () => {
    const page = contentDetailPageState({
      loading: false,
      error: null,
      row: { ...published, status: "published" },
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(`${page.view.statusLabel} ${page.view.publishedLabel}`).not.toMatch(/online|offline/i);
  });
});

describe("tenancy and session", () => {
  it("does not use client-side organization filtering as authorization", () => {
    const rows = contentListRows([
      { ...draft, organizationId: "org_a" },
      { ...published, organizationId: "org_b" },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["cnt_1", "cnt_2"]);
    expect(rows.every((row) => !("organizationId" in row))).toBe(true);
  });

  it("logs out on authenticated 401 through the existing API layer, not 403", () => {
    expect(shouldInvalidateSession("/v1/contents", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/contents/cnt_1", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/contents", 403)).toBe(false);
    expect(shouldInvalidateSession("/v1/contents", 400)).toBe(false);
  });
});

describe("mobile stack helper", () => {
  it("uses the existing stack breakpoint for compact viewports", () => {
    expect(needsContentStackList(390)).toBe(true);
    expect(needsContentStackList(CONTENT_STACK_MAX_PX)).toBe(true);
    expect(needsContentStackList(1440)).toBe(false);
  });
});
