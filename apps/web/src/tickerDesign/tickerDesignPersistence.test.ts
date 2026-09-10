import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_END_BEFORE_START, CAMPAIGN_END_REQUIRED, CAMPAIGN_START_REQUIRED } from "../campaignData";
import {
  DESIGNER_HEIGHT,
  DESIGNER_WIDTH,
  persistDesignerDocument,
  readDesignerNodes,
} from "../tickerDesignerDemo/designerDocument";
import {
  TICKER_DESIGN_LEGACY_PUBLISH,
  TICKER_DESIGN_SCHEDULE_NEED_SAVE,
  TICKER_DESIGN_SCHEDULE_UNPUBLISHED,
  buildTickerScheduleRequest,
  contentBelongsToTickerDesign,
  designDidNotLeak,
  designerSaveBody,
  draftDoesNotReplacePlayback,
  emptyDesignerHasDefaultCopy,
  emptyDesignerWouldReplaceLegacy,
  findTickerSchedule,
  loadedDesignerNodes,
  nextDesignerNodeSeq,
  selectTickerDesignContent,
  tickerDesignTitle,
  tickerDesignerActions,
  tickerDesignerChip,
  tickerPublishBody,
  tickerPublishIsIsolated,
  tickerScheduleName,
} from "./tickerDesignPersistence";

const lobbyNodes = [
  { id: "node-emoji-1", kind: "emoji" as const, emoji: "🪔" },
  { id: "node-text-2", kind: "text" as const, text: "Happy Diwali" },
];

describe("ticker design persistence adapter", () => {
  it("stores the visual flow on the composition document without exposing it as layers", () => {
    const document = persistDesignerDocument({
      tickerId: "tkr_lobby",
      nodes: lobbyNodes,
      width: 620,
      height: 64,
    });
    expect(document.profile).toEqual({ width: DESIGNER_WIDTH, height: DESIGNER_HEIGHT, colorMode: "full" });
    expect(document.layers.some((layer) => layer.type === "text" && layer.id === "message")).toBe(true);
    expect(document.designer).toEqual({ kind: "ticker-flow", tickerId: "tkr_lobby", nodes: lobbyNodes });
    expect(readDesignerNodes(document, "tkr_lobby")).toEqual(lobbyNodes);
    expect(readDesignerNodes(document, "tkr_other")).toBeNull();
    expect(designerSaveBody("Lobby Ticker", document)).toEqual({ title: "Lobby Ticker", document });
  });

  it("uses the selected ticker size instead of a hardcoded matrix", () => {
    const document = persistDesignerDocument({
      tickerId: "tkr_small",
      nodes: [{ id: "node-text-1", kind: "text", text: "Hi" }],
      width: 320,
      height: 32,
    });
    expect(document.profile.width).toBe(320);
    expect(document.profile.height).toBe(32);
  });

  it("never reuses another ticker's content record", () => {
    const lobby = {
      id: "cnt_lobby",
      title: "Lobby Ticker",
      publishedVersionId: "ver_1",
      document: persistDesignerDocument({ tickerId: "tkr_lobby", nodes: lobbyNodes, width: 620, height: 64 }),
    };
    const other = {
      id: "cnt_other",
      title: "Other",
      document: persistDesignerDocument({
        tickerId: "tkr_other",
        nodes: [{ id: "node-text-1", kind: "text", text: "Hello I am Nitin" }],
        width: 620,
        height: 64,
      }),
    };
    const legacy = {
      id: "cnt_legacy",
      title: "Lobby hours",
      document: { schemaVersion: "1", profile: { width: 620, height: 64, colorMode: "full" }, layers: [] },
    };
    expect(selectTickerDesignContent({ tickerId: "tkr_lobby", contents: [other, legacy, lobby] })?.id).toBe("cnt_lobby");
    expect(
      selectTickerDesignContent({
        tickerId: "tkr_lobby",
        playbackContentId: "cnt_other",
        contents: [other, lobby],
      })?.id,
    ).toBe("cnt_lobby");
    expect(selectTickerDesignContent({ tickerId: "tkr_missing", contents: [lobby, other] })).toBeNull();
    expect(loadedDesignerNodes(legacy, "tkr_lobby")).toEqual([]);
    expect(contentBelongsToTickerDesign(lobby, "tkr_lobby")).toBe(true);
    expect(contentBelongsToTickerDesign(other, "tkr_lobby")).toBe(false);
    expect(contentBelongsToTickerDesign(legacy, "tkr_lobby")).toBe(false);
    expect(contentBelongsToTickerDesign({ id: "cnt_x" }, "tkr_lobby")).toBe(false);
  });

  it("does not publish an empty designer over a legacy composition", () => {
    const legacyPlayback = {
      schemaVersion: "1",
      profile: { width: 620, height: 64, colorMode: "full" },
      layers: [{ id: "message", type: "text", zIndex: 10, props: { text: "Lobby hours" } }],
    };
    const designerPlayback = persistDesignerDocument({
      tickerId: "tkr_lobby",
      nodes: lobbyNodes,
      width: 620,
      height: 64,
    });
    expect(
      emptyDesignerWouldReplaceLegacy({
        nodes: [],
        tickerId: "tkr_lobby",
        playbackDocument: legacyPlayback,
      }),
    ).toBe(true);
    expect(
      emptyDesignerWouldReplaceLegacy({
        nodes: lobbyNodes,
        tickerId: "tkr_lobby",
        playbackDocument: legacyPlayback,
      }),
    ).toBe(false);
    expect(
      emptyDesignerWouldReplaceLegacy({
        nodes: [],
        tickerId: "tkr_lobby",
        playbackDocument: designerPlayback,
      }),
    ).toBe(false);
    expect(
      emptyDesignerWouldReplaceLegacy({
        nodes: [],
        tickerId: "tkr_lobby",
        playbackDocument: null,
      }),
    ).toBe(false);
    expect(TICKER_DESIGN_LEGACY_PUBLISH).toBe("Add a design before replacing this ticker's published content.");
  });

  it("prefers the playback content when it belongs to this ticker", () => {
    const first = {
      id: "cnt_old",
      document: persistDesignerDocument({ tickerId: "tkr_lobby", nodes: [], width: 620, height: 64 }),
    };
    const playing = {
      id: "cnt_live",
      document: persistDesignerDocument({ tickerId: "tkr_lobby", nodes: lobbyNodes, width: 620, height: 64 }),
    };
    expect(
      selectTickerDesignContent({
        tickerId: "tkr_lobby",
        playbackContentId: "cnt_live",
        contents: [first, playing],
      })?.id,
    ).toBe("cnt_live");
  });

  it("publishes only the current ticker id", () => {
    expect(tickerPublishBody("tkr_lobby")).toEqual({ tickerIds: ["tkr_lobby"] });
    expect(tickerDesignTitle("  Lobby Ticker  ")).toBe("Lobby Ticker");
    expect(tickerDesignerChip({ name: "Lobby Ticker", width: 620, height: 64, colorMode: "full" })).toBe(
      "Lobby Ticker · 620 × 64 px · Full Color",
    );
    expect(tickerScheduleName("Lobby Ticker")).toBe("Lobby Ticker schedule");
    expect(nextDesignerNodeSeq(lobbyNodes)).toBe(2);
  });

  it("schedules only the selected ticker and requires a published design", () => {
    const published = { id: "cnt_lobby", publishedVersionId: "ver_1", title: "Lobby Ticker" };
    const draft = { id: "cnt_draft", publishedVersionId: null, title: "Lobby Ticker" };
    expect(
      buildTickerScheduleRequest({
        tickerId: "tkr_lobby",
        tickerName: "Lobby Ticker",
        contentId: null,
        startAt: "2026-09-10T10:00",
        endAt: "2026-09-10T12:00",
        contents: [],
      }).ok,
    ).toBe(false);
    expect(
      buildTickerScheduleRequest({
        tickerId: "tkr_lobby",
        tickerName: "Lobby Ticker",
        contentId: null,
        startAt: "2026-09-10T10:00",
        endAt: "2026-09-10T12:00",
        contents: [],
      }),
    ).toEqual({ ok: false, error: TICKER_DESIGN_SCHEDULE_NEED_SAVE });
    expect(
      buildTickerScheduleRequest({
        tickerId: "tkr_lobby",
        tickerName: "Lobby Ticker",
        contentId: "cnt_draft",
        startAt: "2026-09-10T10:00",
        endAt: "2026-09-10T12:00",
        contents: [draft],
      }),
    ).toEqual({ ok: false, error: TICKER_DESIGN_SCHEDULE_UNPUBLISHED });
    const scheduled = buildTickerScheduleRequest({
      tickerId: "tkr_lobby",
      tickerName: "Lobby Ticker",
      contentId: "cnt_lobby",
      startAt: "2026-09-10T10:00",
      endAt: "2026-09-10T12:00",
      contents: [published],
    });
    expect(scheduled.ok).toBe(true);
    if (scheduled.ok) {
      expect(scheduled.body.targetTickerIds).toEqual(["tkr_lobby"]);
      expect(scheduled.body.contentId).toBe("cnt_lobby");
      expect(scheduled.body.status).toBe("scheduled");
      expect(scheduled.body.name).toBe("Lobby Ticker schedule");
    }
    expect(
      findTickerSchedule(
        [
          { id: "cmp_all", contentId: "cnt_lobby", targetTickerIds: ["tkr_lobby", "tkr_other"] },
          { id: "cmp_one", contentId: "cnt_lobby", targetTickerIds: ["tkr_lobby"] },
        ],
        "tkr_lobby",
        "cnt_lobby",
      )?.id,
    ).toBe("cmp_one");
  });

  it("reloads the saved visual flow for that ticker only", () => {
    const welcome = [
      { id: "node-emoji-1", kind: "emoji" as const, emoji: "🪔" },
      { id: "node-text-2", kind: "text" as const, text: "Welcome to Lobby" },
      { id: "node-emoji-3", kind: "emoji" as const, emoji: "✨" },
    ];
    const saved = {
      id: "cnt_lobby",
      document: persistDesignerDocument({ tickerId: "tkr_lobby", nodes: welcome, width: 620, height: 64 }),
    };
    expect(loadedDesignerNodes(selectTickerDesignContent({ tickerId: "tkr_lobby", contents: [saved] }), "tkr_lobby")).toEqual(
      welcome,
    );
    expect(loadedDesignerNodes(saved, "tkr_other")).toEqual([]);
  });

  it("never publishes all org tickers or an empty ticker list", () => {
    const orgTickers = ["tkr_lobby", "tkr_concourse", "tkr_spare"];
    expect(tickerPublishBody("tkr_lobby")).toEqual({ tickerIds: ["tkr_lobby"] });
    expect(tickerPublishIsIsolated("tkr_lobby", orgTickers)).toBe(true);
    expect(tickerPublishIsIsolated("tkr_lobby", ["tkr_lobby"])).toBe(true);
    expect(tickerPublishIsIsolated("", orgTickers)).toBe(false);
  });

  it("keeps another ticker's playback isolated from a lobby publish", () => {
    const lobbyDoc = persistDesignerDocument({
      tickerId: "tkr_lobby",
      nodes: lobbyNodes,
      width: 620,
      height: 64,
    });
    const otherDoc = persistDesignerDocument({
      tickerId: "tkr_concourse",
      nodes: [{ id: "node-text-1", kind: "text", text: "Concourse hours" }],
      width: 620,
      height: 64,
    });
    expect(designDidNotLeak(otherDoc, "tkr_lobby")).toBe(true);
    expect(designDidNotLeak(lobbyDoc, "tkr_lobby")).toBe(false);
    expect(readDesignerNodes(otherDoc, "tkr_lobby")).toBeNull();
  });

  it("does not inject default copy when saving an empty design", () => {
    const empty = persistDesignerDocument({ tickerId: "tkr_empty", nodes: [], width: 620, height: 64 });
    expect(empty.layers.some((layer) => layer.type === "text")).toBe(false);
    expect(emptyDesignerHasDefaultCopy(empty)).toBe(false);
  });

  it("keeps published playback on the previous version while a newer draft exists", () => {
    const publishedNodes = lobbyNodes;
    const draftNodes = [{ id: "node-text-9", kind: "text" as const, text: "Welcome to Lobby — Updated" }];
    const published = persistDesignerDocument({ tickerId: "tkr_lobby", nodes: publishedNodes, width: 620, height: 64 });
    expect(
      draftDoesNotReplacePlayback({
        tickerId: "tkr_lobby",
        publishedNodes,
        draftNodes,
        playbackDocument: published,
      }),
    ).toBe(true);
  });

  it("rejects invalid schedules before calling the API", () => {
    const published = { id: "cnt_lobby", publishedVersionId: "ver_1", title: "Lobby Ticker" };
    const missingStart = buildTickerScheduleRequest({
      tickerId: "tkr_lobby",
      tickerName: "Lobby Ticker",
      contentId: "cnt_lobby",
      startAt: "",
      endAt: "2026-09-10T12:00",
      contents: [published],
    });
    const missingEnd = buildTickerScheduleRequest({
      tickerId: "tkr_lobby",
      tickerName: "Lobby Ticker",
      contentId: "cnt_lobby",
      startAt: "2026-09-10T10:00",
      endAt: "",
      contents: [published],
    });
    const inverted = buildTickerScheduleRequest({
      tickerId: "tkr_lobby",
      tickerName: "Lobby Ticker",
      contentId: "cnt_lobby",
      startAt: "2026-09-10T12:00",
      endAt: "2026-09-10T10:00",
      contents: [published],
    });
    expect(missingStart).toEqual({ ok: false, error: CAMPAIGN_START_REQUIRED });
    expect(missingEnd).toEqual({ ok: false, error: CAMPAIGN_END_REQUIRED });
    expect(inverted).toEqual({ ok: false, error: CAMPAIGN_END_BEFORE_START });
  });

  it("maps customer roles onto designer actions without enabling extra permissions", () => {
    expect(tickerDesignerActions("viewer")).toEqual({
      canEdit: false,
      canSave: false,
      canPublish: false,
      canSchedule: false,
    });
    expect(tickerDesignerActions("designer")).toEqual({
      canEdit: true,
      canSave: true,
      canPublish: false,
      canSchedule: false,
    });
    expect(tickerDesignerActions("content_manager")).toEqual({
      canEdit: true,
      canSave: true,
      canPublish: true,
      canSchedule: true,
    });
    expect(tickerDesignerActions("organization_owner")).toEqual({
      canEdit: true,
      canSave: true,
      canPublish: true,
      canSchedule: true,
    });
    expect(tickerDesignerActions("organization_admin")).toEqual({
      canEdit: true,
      canSave: true,
      canPublish: true,
      canSchedule: true,
    });
    expect(tickerDesignerActions("operator")).toEqual({
      canEdit: false,
      canSave: false,
      canPublish: false,
      canSchedule: false,
    });
  });

  it("keeps the real designer on ticker-specific save/publish APIs without campaign wording", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pageSrc = readFileSync(join(dir, "../TickerDesignPage.tsx"), "utf8");
    const canvasSrc = readFileSync(join(dir, "../tickerDesignerDemo/DesignerCanvas.tsx"), "utf8");
    expect(pageSrc).toContain("tickerPublishBody(id)");
    expect(pageSrc).toContain("contentBelongsToTickerDesign(content, id)");
    expect(pageSrc).toContain("emptyDesignerWouldReplaceLegacy");
    expect(pageSrc).toContain("POST");
    expect(pageSrc).toContain("/v1/contents");
    expect(pageSrc).toContain("/v1/contents/${saved.id}/publish");
    expect(pageSrc).not.toContain("tickerIds: []");
    expect(pageSrc).not.toContain("tickerIds: organization");
    expect(canvasSrc).toContain("Schedule Ticker");
    expect(canvasSrc).toContain("Save & Publish");
    expect(canvasSrc).not.toMatch(/\bCampaign\b/);
    expect(canvasSrc).not.toContain("Content ID");
    expect(canvasSrc).not.toContain("tickerIds");
    expect(canvasSrc).not.toContain("CompositionDocument");
    expect(pageSrc).not.toContain("Create Campaign");
  });
});
