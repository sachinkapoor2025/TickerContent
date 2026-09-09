import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import {
  TEMPLATES_EMPTY_DESCRIPTION,
  TEMPLATES_EMPTY_TITLE,
  TEMPLATES_ERROR_MESSAGE,
  TEMPLATES_LOADING_MESSAGE,
  TEMPLATES_PAGE_DESCRIPTION,
  TEMPLATES_STACK_MAX_PX,
  TEMPLATE_USE_ERROR,
  TEMPLATE_USING_LABEL,
  needsTemplateStackList,
  templateListRows,
  templateUseBody,
  templateUseLabel,
  templatesPageState,
} from "./templateData.js";

const blank = {
  id: "tpl_blank",
  organizationId: null,
  title: "Blank ticker",
  visibility: "platform",
  category: "Business",
  documentJson: "{}",
  document: { schemaVersion: "1", layers: [] },
};

const diwali = {
  id: "tpl_diwali",
  title: "Festival — Diwali",
  category: "Festivals",
  organizationId: "org_secret",
};

describe("templates page", () => {
  it("maps real template titles and categories without fake metadata", () => {
    const rows = templateListRows([blank, diwali]);
    expect(rows).toEqual([
      { id: "tpl_blank", name: "Blank ticker", category: "Business" },
      { id: "tpl_diwali", name: "Festival — Diwali", category: "Festivals" },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/thumbnail|popular|recommended|usage|organizationId|documentJson|visibility/i);
    expect(TEMPLATES_PAGE_DESCRIPTION).toBe("Start new content from a template.");
  });

  it("uses the existing content-create contract when using a template", () => {
    expect(templateUseBody("Blank ticker", "tpl_blank")).toEqual({ title: "Blank ticker", templateId: "tpl_blank" });
    expect(templateUseLabel(true)).toBe(TEMPLATE_USING_LABEL);
    expect(templateUseLabel(false)).toBe("Use template");
    expect(TEMPLATE_USE_ERROR).toBe("Unable to use this template.");
  });

  it("uses empty, loading, and error states without inventing cards", () => {
    expect(templatesPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: TEMPLATES_LOADING_MESSAGE,
    });
    expect(templatesPageState({ loading: false, error: null, items: [] })).toMatchObject({ kind: "ready", empty: true });
    expect(TEMPLATES_EMPTY_TITLE).toBe("No templates yet");
    expect(TEMPLATES_EMPTY_DESCRIPTION).toMatch(/available to this workspace/);
    expect(templatesPageState({ loading: false, error: null, items: null }).kind).toBe("error");
    expect(TEMPLATES_ERROR_MESSAGE).toBe("Unable to load your templates.");
  });

  it("keeps 401 session handling unchanged", () => {
    expect(shouldInvalidateSession("/v1/templates", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/templates", 403)).toBe(false);
    expect(shouldInvalidateSession("/v1/contents", 401)).toBe(true);
  });

  it("uses the existing stack breakpoint", () => {
    expect(needsTemplateStackList(390)).toBe(true);
    expect(needsTemplateStackList(TEMPLATES_STACK_MAX_PX)).toBe(true);
    expect(needsTemplateStackList(1440)).toBe(false);
  });
});
