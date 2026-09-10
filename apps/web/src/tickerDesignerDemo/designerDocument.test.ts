import { describe, expect, it } from "vitest";
import {
  DESIGNER_API_DEFAULT_MOCK,
  DESIGNER_API_TEST_TOAST,
  DESIGNER_DISPLAY_SIZE_LABEL,
  DESIGNER_EMOJI_GROUPS,
  DESIGNER_HEIGHT,
  DESIGNER_PUBLISH_TOAST,
  DESIGNER_SAVE_TOAST,
  DESIGNER_SCHEDULE_TOAST,
  DESIGNER_WIDTH,
  appendDesignerNode,
  applyEffectOccasion,
  buildDesignerDocument,
  clearAllNodes,
  clearSelectedNode,
  composeFlowMessage,
  connectDesignerApi,
  createDesignerNode,
  createInitialFlow,
  designerProfileColorMode,
  designerScrolling,
  effectsForOccasion,
  filterEmojiGroups,
  mockApiJson,
  nextSelectedId,
  nodeSummary,
  persistDesignerDocument,
  readDesignerNodes,
  removeDesignerNode,
  resolveFlowPlayback,
} from "./designerDocument";

describe("ticker designer playground model", () => {
  it("starts empty with no default text, emoji, or hidden composition", () => {
    expect(createInitialFlow()).toEqual([]);
    expect(clearAllNodes()).toEqual([]);
    expect(DESIGNER_DISPLAY_SIZE_LABEL).toBe("620 × 64");
    const playback = resolveFlowPlayback([]);
    expect(playback.message).toBe("");
    expect(playback.animationKind).toBe("static");
    expect(playback.colorMode).toBe("rgb");
    expect(playback.effect).toBe("none");
    const doc = buildDesignerDocument(playback);
    expect(doc.profile).toEqual({ width: DESIGNER_WIDTH, height: DESIGNER_HEIGHT, colorMode: "full" });
    expect(doc.layers.some((layer) => layer.type === "text")).toBe(false);
  });

  it("adds text, emoji, animation, color, effect, and api independently in user order", () => {
    let nodes = appendDesignerNode([], "text", "t1");
    nodes = appendDesignerNode(nodes, "emoji", "e1");
    nodes = appendDesignerNode(nodes, "animation", "a1");
    nodes = appendDesignerNode(nodes, "color", "c1");
    nodes = appendDesignerNode(nodes, "effect", "x1");
    nodes = appendDesignerNode(nodes, "api", "p1");
    expect(nodes.map((node) => node.kind)).toEqual(["text", "emoji", "animation", "color", "effect", "api"]);
    expect(nodes[0] && nodes[0].kind === "text" ? nodes[0].text : "x").toBe("");
    expect(nodes[1] && nodes[1].kind === "emoji" ? nodes[1].emoji : "x").toBe("");
    expect(nodes[2] && nodes[2].kind === "animation" ? nodes[2].animationKind : "x").toBe("static");
    expect(nodes[3] && nodes[3].kind === "color" ? nodes[3].colorMode : "x").toBe("rgb");
    expect(nodes[4] && nodes[4].kind === "effect" ? nodes[4].effect : "x").toBe("snow");
    expect(nodes[5] && nodes[5].kind === "api" ? nodes[5].connected : true).toBe(false);
  });

  it("lets any kind be first and composes multiple text and emoji blocks in order", () => {
    expect(appendDesignerNode([], "emoji", "e1")[0]?.kind).toBe("emoji");
    expect(appendDesignerNode([], "api", "p1")[0]?.kind).toBe("api");
    const welcome = [
      { id: "t1", kind: "text" as const, text: "Welcome" },
      { id: "t2", kind: "text" as const, text: "to Photonplay" },
      { id: "t3", kind: "text" as const, text: "India" },
    ];
    expect(composeFlowMessage(welcome)).toBe("Welcome to Photonplay India");
    const diwali = [
      { id: "e1", kind: "emoji" as const, emoji: "🪔" },
      { id: "t1", kind: "text" as const, text: "Happy Diwali!" },
      { id: "e2", kind: "emoji" as const, emoji: "✨" },
      { id: "e3", kind: "emoji" as const, emoji: "🎉" },
    ];
    expect(composeFlowMessage(diwali)).toBe("🪔 Happy Diwali! ✨ 🎉");
  });

  it("keeps the specified emoji groups and practical glyphs", () => {
    expect(DESIGNER_EMOJI_GROUPS.map((group) => group.id)).toEqual([
      "frequent",
      "celebration",
      "festivals",
      "nature",
      "food",
      "hearts",
      "objects",
      "people",
    ]);
    const glyphs = (id: string) =>
      DESIGNER_EMOJI_GROUPS.find((group) => group.id === id)?.items.map((item) => item.glyph) ?? [];
    expect(glyphs("frequent")).toEqual(["😀", "❤️", "⭐", "✨", "👍"]);
    expect(glyphs("festivals")).toEqual(["🪔", "🎄", "🎃", "🎆", "🎁", "❄️"]);
    expect(glyphs("objects")).toContain("📡");
    expect(filterEmojiGroups("diya").some((group) => group.items.some((item) => item.glyph === "🪔"))).toBe(true);
    expect(filterEmojiGroups("zzzz")).toEqual([]);
  });

  it("turns Dynamic + Scroll on and keeps Static stationary", () => {
    const staticNode = createDesignerNode("animation", "a1");
    expect(staticNode.kind === "animation" ? staticNode.animationKind : "x").toBe("static");
    expect(designerScrolling(resolveFlowPlayback([staticNode]))).toBe(false);
    const scrolling = {
      id: "a1",
      kind: "animation" as const,
      animationKind: "dynamic" as const,
      movement: "scroll" as const,
    };
    const playback = resolveFlowPlayback([scrolling]);
    expect(designerScrolling(playback)).toBe(true);
    expect(nodeSummary(scrolling)).toBe("Scroll");
    const doc = buildDesignerDocument({
      ...playback,
      message: "Happy Diwali!",
    });
    const text = doc.layers.find((layer) => layer.id === "message");
    expect(text?.type === "text" ? text.props.scrollPxPerSec : 0).toBeGreaterThan(0);
  });

  it("uses the latest Color block and maps RGB vs selected mono color", () => {
    const rgb = { id: "c1", kind: "color" as const, colorMode: "rgb" as const, colorId: "amber" as const };
    const monoRed = { id: "c2", kind: "color" as const, colorMode: "mono" as const, colorId: "red" as const };
    const monoAmber = { id: "c3", kind: "color" as const, colorMode: "mono" as const, colorId: "amber" as const };
    expect(designerProfileColorMode(resolveFlowPlayback([rgb]).colorMode)).toBe("full");
    expect(nodeSummary(rgb)).toBe("RGB / Full Color");
    expect(resolveFlowPlayback([rgb, monoRed]).colorId).toBe("red");
    const latest = resolveFlowPlayback([rgb, monoRed, monoAmber]);
    expect(latest.colorMode).toBe("mono");
    expect(latest.colorId).toBe("amber");
    expect(nodeSummary(monoAmber)).toBe("Mono · Amber");
    expect(buildDesignerDocument(latest).profile.colorMode).toBe("mono");
  });

  it("selects occasion effects and renders only ready overlays from the latest Effect block", () => {
    const snow = { id: "x1", kind: "effect" as const, occasion: "christmas" as const, effect: "snow" as const };
    const sparkles = { id: "x2", kind: "effect" as const, occasion: "diwali" as const, effect: "sparkles" as const };
    expect(effectsForOccasion("christmas").map((item) => item.id)).toEqual(["snow", "santa"]);
    expect(effectsForOccasion("diwali").map((item) => item.id)).toEqual(["diyas", "sparkles"]);
    expect(applyEffectOccasion(snow, "diwali").effect).toBe("diyas");
    expect(resolveFlowPlayback([snow, sparkles]).effect).toBe("sparkles");
    const sparkDoc = buildDesignerDocument(resolveFlowPlayback([sparkles]));
    expect(sparkDoc.layers.some((layer) => layer.id.startsWith("fx-sparkles-"))).toBe(true);
    const snowDoc = buildDesignerDocument(resolveFlowPlayback([snow]));
    expect(snowDoc.layers.some((layer) => layer.id.startsWith("fx-snow-"))).toBe(true);
    expect(nodeSummary(sparkles)).toBe("Diwali");
  });

  it("keeps API local/mock and only composes the mock value after a demo connection", () => {
    const pending = createDesignerNode("api", "p1");
    expect(pending.kind === "api" ? pending.connected : true).toBe(false);
    expect(composeFlowMessage([{ id: "t1", kind: "text", text: "Current status" }, pending])).toBe("Current status");
    const connected =
      pending.kind === "api"
        ? connectDesignerApi({ ...pending, mockValue: "All systems operational" })
        : pending;
    expect(connected.kind === "api" ? connected.connected : false).toBe(true);
    expect(mockApiJson(connected.kind === "api" ? connected : pending)).toContain("All systems operational");
    expect(
      composeFlowMessage([
        { id: "t1", kind: "text", text: "Current status" },
        connected,
        { id: "e1", kind: "emoji", emoji: "📡" },
      ]),
    ).toBe("Current status All systems operational 📡");
    expect(
      composeFlowMessage([
        { id: "t1", kind: "text", text: "Temperature" },
        connectDesignerApi({
          id: "p2",
          kind: "api",
          url: "https://example.com/ticker",
          field: "message",
          method: "GET",
          refreshSeconds: 30,
          connected: false,
          mockValue: "32°C",
        }),
        { id: "e1", kind: "emoji", emoji: "🌡️" },
      ]),
    ).toBe("Temperature 32°C 🌡️");
    expect(nodeSummary(pending)).toBe("Not connected");
    expect(nodeSummary(connected)).toBe("Connected");
    expect(DESIGNER_API_TEST_TOAST).toBe("✓ Demo connection successful");
    expect(DESIGNER_API_DEFAULT_MOCK).toBe("Welcome to Photonplay");
  });

  it("reconnects after a middle remove and Clear empties selection without restoring defaults", () => {
    const nodes = [
      { id: "e1", kind: "emoji" as const, emoji: "🪔" },
      { id: "t1", kind: "text" as const, text: "Happy Diwali!" },
      { id: "e2", kind: "emoji" as const, emoji: "✨" },
    ];
    expect(removeDesignerNode(nodes, "t1").map((node) => node.id)).toEqual(["e1", "e2"]);
    expect(composeFlowMessage(removeDesignerNode(nodes, "t1"))).toBe("🪔 ✨");
    expect(nextSelectedId(nodes, "t1", "t1")).toBe("e2");
    expect(clearSelectedNode(nodes, "t1")).toEqual({
      nodes: [
        { id: "e1", kind: "emoji", emoji: "🪔" },
        { id: "e2", kind: "emoji", emoji: "✨" },
      ],
      selectedId: null,
    });
    expect(clearAllNodes()).toEqual([]);
    expect(DESIGNER_SAVE_TOAST).toBe("✓ Saved");
    expect(DESIGNER_PUBLISH_TOAST).toBe("✓ Published");
    expect(DESIGNER_SCHEDULE_TOAST).toBe("✓ Schedule saved");
  });

  it("persists the visual flow on the selected ticker size and never loads another ticker's nodes", () => {
    const nodes = [
      { id: "e1", kind: "emoji" as const, emoji: "🪔" },
      { id: "t1", kind: "text" as const, text: "Happy Diwali" },
    ];
    const doc = persistDesignerDocument({ tickerId: "tkr_lobby", nodes, width: 320, height: 32 });
    expect(doc.profile).toEqual({ width: 320, height: 32, colorMode: "full" });
    expect(readDesignerNodes(doc, "tkr_lobby")).toEqual(nodes);
    expect(readDesignerNodes(doc, "tkr_other")).toBeNull();
    expect(buildDesignerDocument(resolveFlowPlayback(nodes), { width: 400, height: 48 }).profile).toEqual({
      width: 400,
      height: 48,
      colorMode: "full",
    });
  });
});
