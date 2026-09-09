import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import {
  CAMPAIGNS_EMPTY_DESCRIPTION,
  CAMPAIGNS_EMPTY_TITLE,
  CAMPAIGNS_ERROR_MESSAGE,
  CAMPAIGNS_LOADING_MESSAGE,
  CAMPAIGNS_PAGE_DESCRIPTION,
  CAMPAIGN_CREATE_ERROR,
  CAMPAIGN_CREATING_LABEL,
  CAMPAIGN_DETAIL_ERROR_MESSAGE,
  CAMPAIGN_DETAIL_LOADING_MESSAGE,
  CAMPAIGN_END_BEFORE_START,
  CAMPAIGN_NO_CONTENT_DESCRIPTION,
  CAMPAIGN_NO_CONTENT_TITLE,
  CAMPAIGN_NO_DISPLAYS_DESCRIPTION,
  CAMPAIGN_NO_DISPLAYS_TITLE,
  CAMPAIGN_NO_PUBLISHED_DESCRIPTION,
  CAMPAIGN_NO_PUBLISHED_TITLE,
  CAMPAIGN_STACK_MAX_PX,
  CAMPAIGN_TICKERS_REQUIRED,
  CAMPAIGN_UNPUBLISHED_MESSAGE,
  campaignCatalog,
  campaignCreateBody,
  campaignDetailPageState,
  campaignListRows,
  campaignPauseBody,
  campaignResumeBody,
  campaignStatusLabel,
  campaignSubmitLabel,
  campaignsPageState,
  contentOptions,
  createdCampaignHref,
  displayOptions,
  findCampaign,
  isPlayableCampaignStatus,
  needsCampaignStackList,
  toggleTickerSelection,
  unpublishedContentWarning,
  validateCampaignForm,
  type CampaignRecord,
} from "./campaignData.js";
import type { ContentRecord } from "./contentData.js";
import type { TickerRecord } from "./tickerData.js";

const draftContent: ContentRecord = {
  id: "cnt_draft",
  organizationId: "org_secret",
  title: "Unpublished draft",
  status: "draft",
  headDraftVersionId: "ver_draft",
  publishedVersionId: null,
};

const publishedContent: ContentRecord = {
  id: "cnt_pub",
  title: "WELCOME",
  status: "published",
  headDraftVersionId: "ver_draft_2",
  publishedVersionId: "ver_published",
};

const lobby: TickerRecord = { id: "tkr_1", name: "Lobby ticker", width: 620, height: 64, status: "active" };
const concourse: TickerRecord = { id: "tkr_2", name: "Concourse ticker", width: 320, height: 32, status: "active" };

const lobbyCampaign: CampaignRecord = {
  id: "cmp_1",
  organizationId: "org_secret",
  name: "Lobby campaign",
  status: "scheduled",
  priority: 100,
  startAt: "2026-09-10T12:00:00.000Z",
  endAt: "2026-09-20T12:00:00.000Z",
  contentId: "cnt_pub",
  publishedVersionId: "ver_published",
  targetTickerIds: ["tkr_1", "tkr_2"],
  recurrence: null,
};

function validForm(overrides: Record<string, unknown> = {}) {
  return {
    name: "Morning welcome",
    contentId: "cnt_pub",
    targetTickerIds: ["tkr_1"],
    status: "scheduled",
    startAt: "2026-09-10T09:00",
    endAt: "2026-09-12T09:00",
    ...overrides,
  };
}

describe("campaign workspace copy", () => {
  it("describes scheduling without marketing or analytics claims", () => {
    expect(CAMPAIGNS_PAGE_DESCRIPTION).toBe("Schedule published content across your displays.");
    expect(CAMPAIGNS_PAGE_DESCRIPTION).not.toMatch(/impressions|delivery|reach|engagement|analytics|online|offline/i);
    expect(CAMPAIGNS_EMPTY_TITLE).toBe("No campaigns yet");
    expect(CAMPAIGNS_EMPTY_DESCRIPTION).toBe("Create a campaign to schedule published content on your displays.");
  });
});

describe("campaign list mapping", () => {
  it("maps real campaign names, content titles, display names, schedule, and status", () => {
    const rows = campaignListRows([lobbyCampaign], [publishedContent, draftContent], [lobby, concourse]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Lobby campaign",
      href: "/campaigns/cmp_1",
      contentTitle: "WELCOME",
      contentHref: "/content/cnt_pub",
      displaysLabel: "Lobby ticker, Concourse ticker",
      statusLabel: "Scheduled",
    });
    expect(rows[0]?.scheduleLabel).toContain("–");
    expect(rows[0]?.scheduleLabel).not.toBe("—");
    expect(JSON.stringify(rows)).not.toMatch(/org_secret|organizationId|ver_published|priority|recurrence/);
    expect(JSON.stringify(rows)).not.toMatch(/impressions|delivery %|reach|engagement/i);
    expect(JSON.stringify(rows)).not.toMatch(/online|offline/i);
  });

  it("resolves multiple target display names from the ticker list", () => {
    const rows = campaignListRows(
      [{ ...lobbyCampaign, targetTickerIds: ["tkr_2", "tkr_1"] }],
      [publishedContent],
      [lobby, concourse],
    );
    expect(rows[0]?.displaysLabel).toBe("Concourse ticker, Lobby ticker");
  });
});

describe("campaign detail mapping", () => {
  it("shows published snapshot state separately from draft content", () => {
    const page = campaignDetailPageState({
      loading: false,
      error: null,
      campaign: lobbyCampaign,
      contents: [
        {
          ...publishedContent,
          headDraftVersionId: "ver_draft_2",
          publishedVersionId: "ver_published",
        },
      ],
      tickers: [lobby, concourse],
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.name).toBe("Lobby campaign");
    expect(page.view.contentTitle).toBe("WELCOME");
    expect(page.view.publishedLabel).toBe("Published");
    expect(page.view.published).toBe(true);
    expect(page.view.displays.map((item) => item.name)).toEqual(["Lobby ticker", "Concourse ticker"]);
    expect(page.view.displays[0]?.profile).toBe("620 × 64 px");
    expect(page.view.canPause).toBe(true);
    expect(page.view.canResume).toBe(false);
    expect(`${page.view.statusLabel} ${page.view.publishedLabel}`).not.toMatch(/online|offline/i);
    expect(JSON.stringify(page.view)).not.toMatch(/org_secret|impressions|delivery/i);
  });

  it("loads a campaign from the list by id without a dedicated GET route", () => {
    expect(findCampaign([lobbyCampaign], "cmp_1")?.name).toBe("Lobby campaign");
    expect(findCampaign([lobbyCampaign], "cmp_missing")).toBeNull();
  });
});

describe("content and ticker selection", () => {
  it("uses content titles rather than ids as labels", () => {
    const options = contentOptions([draftContent, publishedContent]);
    expect(options.map((item) => item.title)).toEqual(["Unpublished draft", "WELCOME"]);
    expect(options[0]?.published).toBe(false);
    expect(options[1]?.published).toBe(true);
    expect(options.some((item) => item.title === "cnt_draft")).toBe(false);
  });

  it("uses ticker names and display profiles for target selection", () => {
    const options = displayOptions([lobby, concourse]);
    expect(options[0]).toMatchObject({
      name: "Lobby ticker",
      profile: "620 × 64 px",
      label: "Lobby ticker 620 × 64 px",
    });
    expect(JSON.stringify(options)).not.toMatch(/online|offline|heartbeat/i);
  });

  it("supports selecting one or more tickers", () => {
    expect(toggleTickerSelection([], "tkr_1", true)).toEqual(["tkr_1"]);
    expect(toggleTickerSelection(["tkr_1"], "tkr_2", true)).toEqual(["tkr_1", "tkr_2"]);
    expect(toggleTickerSelection(["tkr_1", "tkr_2"], "tkr_1", false)).toEqual(["tkr_2"]);
  });
});

describe("published version requirement", () => {
  it("warns when selected content has no published version", () => {
    expect(unpublishedContentWarning(draftContent)).toBe(CAMPAIGN_UNPUBLISHED_MESSAGE);
    expect(unpublishedContentWarning(publishedContent)).toBeNull();
  });

  it("rejects a playable campaign that still points at unpublished content", () => {
    const result = validateCampaignForm(validForm({ contentId: "cnt_draft" }), [draftContent, publishedContent]);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.published).toBe(CAMPAIGN_UNPUBLISHED_MESSAGE);
  });

  it("does not treat the current draft as the published snapshot", () => {
    expect(publishedContent.headDraftVersionId).toBe("ver_draft_2");
    expect(publishedContent.publishedVersionId).toBe("ver_published");
    expect(publishedContent.headDraftVersionId).not.toBe(publishedContent.publishedVersionId);
    const result = validateCampaignForm(validForm(), [publishedContent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.contentId).toBe("cnt_pub");
    expect(campaignCreateBody(result.values)).not.toHaveProperty("publishedVersionId");
  });
});

describe("schedule validation", () => {
  it("requires start and end and rejects end before start", () => {
    const missing = validateCampaignForm(validForm({ startAt: "", endAt: "" }), [publishedContent]);
    expect(missing.ok).toBe(false);
    expect(missing.fieldErrors.startAt).toBeTruthy();
    expect(missing.fieldErrors.endAt).toBeTruthy();

    const inverted = validateCampaignForm(
      validForm({ startAt: "2026-09-12T10:00", endAt: "2026-09-10T10:00" }),
      [publishedContent],
    );
    expect(inverted.ok).toBe(false);
    expect(inverted.fieldErrors.endAt).toBe(CAMPAIGN_END_BEFORE_START);
  });

  it("accepts a valid start before end", () => {
    const result = validateCampaignForm(validForm(), [publishedContent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Date(result.values.startAt).getTime()).toBeLessThan(new Date(result.values.endAt).getTime());
  });
});

describe("empty, loading, and error states", () => {
  it("shows an empty campaign list from real API results", () => {
    const page = campaignsPageState({
      loading: false,
      error: null,
      campaigns: [],
      contents: [publishedContent],
      tickers: [lobby],
    });
    expect(page).toMatchObject({ kind: "ready", empty: true, total: 0 });
    expect(CAMPAIGNS_EMPTY_TITLE).toBe("No campaigns yet");
  });

  it("describes missing content, displays, and published content", () => {
    expect(campaignCatalog([], [lobby])).toMatchObject({ hasContent: false, hasPublishedContent: false, hasDisplays: true });
    expect(campaignCatalog([draftContent], [])).toMatchObject({ hasContent: true, hasPublishedContent: false, hasDisplays: false });
    expect(campaignCatalog([publishedContent], [lobby])).toMatchObject({ hasPublishedContent: true, hasDisplays: true });
    expect(CAMPAIGN_NO_CONTENT_TITLE).toBe("No content available");
    expect(CAMPAIGN_NO_CONTENT_DESCRIPTION).toBe("Create content before creating a campaign.");
    expect(CAMPAIGN_NO_DISPLAYS_TITLE).toBe("No displays available");
    expect(CAMPAIGN_NO_DISPLAYS_DESCRIPTION).toBe("Add a display before creating a campaign.");
    expect(CAMPAIGN_NO_PUBLISHED_TITLE).toBe("No published content available");
    expect(CAMPAIGN_NO_PUBLISHED_DESCRIPTION).toBe("Publish content from the editor before creating a campaign.");
  });

  it("uses loading and error copy without faking an empty list", () => {
    expect(campaignsPageState({
      loading: true,
      error: null,
      campaigns: null,
      contents: null,
      tickers: null,
    })).toEqual({ kind: "loading", message: CAMPAIGNS_LOADING_MESSAGE });
    expect(campaignsPageState({
      loading: false,
      error: "boom",
      campaigns: null,
      contents: null,
      tickers: null,
    })).toEqual({ kind: "error", message: "boom" });
    expect(campaignsPageState({
      loading: false,
      error: null,
      campaigns: null,
      contents: null,
      tickers: null,
    })).toEqual({ kind: "error", message: CAMPAIGNS_ERROR_MESSAGE });
    expect(campaignDetailPageState({
      loading: true,
      error: null,
      campaign: null,
      contents: null,
      tickers: null,
    }).kind).toBe("loading");
    expect(CAMPAIGN_DETAIL_LOADING_MESSAGE).toBe("Loading campaign…");
    expect(CAMPAIGN_DETAIL_ERROR_MESSAGE).toBe("Unable to load this campaign.");
  });
});

describe("create validation and submit states", () => {
  it("requires a name, published content, and a display for scheduled campaigns", () => {
    const result = validateCampaignForm(validForm({ name: "  ", targetTickerIds: [] }), [publishedContent]);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBeTruthy();
    expect(result.fieldErrors.targetTickerIds).toBe(CAMPAIGN_TICKERS_REQUIRED);
  });

  it("submits only the fields the campaign API accepts", () => {
    const result = validateCampaignForm(validForm({ targetTickerIds: ["tkr_1", "tkr_2"] }), [publishedContent]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(campaignCreateBody(result.values)).toEqual({
      name: "Morning welcome",
      contentId: "cnt_pub",
      targetTickerIds: ["tkr_1", "tkr_2"],
      status: "scheduled",
      startAt: result.values.startAt,
      endAt: result.values.endAt,
    });
    expect(campaignCreateBody(result.values)).not.toHaveProperty("priority");
    expect(campaignCreateBody(result.values)).not.toHaveProperty("recurrence");
    expect(campaignCreateBody(result.values)).not.toHaveProperty("organizationId");
  });

  it("uses Creating… while submitting and a generic failure message", () => {
    expect(campaignSubmitLabel("create", true)).toBe(CAMPAIGN_CREATING_LABEL);
    expect(campaignSubmitLabel("create", false)).toBe("Create campaign");
    expect(campaignSubmitLabel("save", true)).toBe("Saving…");
    expect(CAMPAIGN_CREATE_ERROR).toBe("Unable to create campaign.");
    expect(createdCampaignHref("cmp_new")).toBe("/campaigns/cmp_new");
  });

  it("exposes pause and resume through existing status PATCH payloads", () => {
    expect(isPlayableCampaignStatus("scheduled")).toBe(true);
    expect(isPlayableCampaignStatus("running")).toBe(true);
    expect(isPlayableCampaignStatus("paused")).toBe(false);
    expect(campaignPauseBody()).toEqual({ status: "paused" });
    expect(campaignResumeBody()).toEqual({ status: "scheduled" });
  });
});

describe("real status rendering", () => {
  it("uses the API status enum with text labels", () => {
    expect(campaignStatusLabel("draft")).toBe("Draft");
    expect(campaignStatusLabel("scheduled")).toBe("Scheduled");
    expect(campaignStatusLabel("running")).toBe("Running");
    expect(campaignStatusLabel("paused")).toBe("Paused");
    expect(campaignStatusLabel("cancelled")).toBe("Cancelled");
    expect(campaignStatusLabel("ended")).toBe("Ended");
    expect(campaignStatusLabel("scheduled")).not.toMatch(/online|offline/i);
  });
});

describe("tenancy and session", () => {
  it("does not use client-side organization filtering as authorization", () => {
    const rows = campaignListRows(
      [{ ...lobbyCampaign, organizationId: "org_a" }],
      [{ ...publishedContent, organizationId: "org_b" }],
      [lobby],
    );
    expect(rows.map((row) => row.id)).toEqual(["cmp_1"]);
    expect(rows.every((row) => !("organizationId" in row))).toBe(true);
  });

  it("logs out on authenticated 401 through the existing API layer, not 403", () => {
    expect(shouldInvalidateSession("/v1/campaigns", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/campaigns/cmp_1", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/campaigns", 403)).toBe(false);
    expect(shouldInvalidateSession("/v1/campaigns", 400)).toBe(false);
  });
});

describe("mobile stack helper", () => {
  it("uses the existing stack breakpoint for compact viewports", () => {
    expect(needsCampaignStackList(390)).toBe(true);
    expect(needsCampaignStackList(CAMPAIGN_STACK_MAX_PX)).toBe(true);
    expect(needsCampaignStackList(1440)).toBe(false);
  });
});
