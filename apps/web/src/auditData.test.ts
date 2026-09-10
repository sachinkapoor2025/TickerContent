import { describe, expect, it } from "vitest";
import {
  AUDIT_EMPTY_DESCRIPTION,
  AUDIT_EMPTY_TITLE,
  AUDIT_ERROR_MESSAGE,
  AUDIT_LOADING_MESSAGE,
  auditListRows,
  auditPageState,
  type AuditRecord,
} from "./auditData.js";

const event: AuditRecord = {
  id: "aud_1",
  organizationId: "org_secret",
  actorUserId: "usr_secret",
  action: "content.published",
  resourceType: "content",
  resourceId: "cnt_1",
  source: "human",
  payloadJson: "{\"token\":\"super-secret\"}",
  createdAt: "2026-09-10T00:00:00.000Z",
};

describe("audit page mapping", () => {
  it("maps real events and omits payload, actor, and organization identifiers", () => {
    const rows = auditListRows([event, { action: "no-id" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "aud_1",
      action: "content.published",
      source: "human",
    });
    expect(rows[0]?.when).not.toBe("—");
    expect(JSON.stringify(rows)).not.toMatch(/org_secret|usr_secret|super-secret|payloadJson|organizationId/);
  });

  it("covers loading, error, and empty states", () => {
    expect(auditPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: AUDIT_LOADING_MESSAGE,
    });
    expect(auditPageState({ loading: false, error: "nope", items: [] })).toEqual({
      kind: "error",
      message: "nope",
    });
    expect(auditPageState({ loading: false, error: null, items: null })).toEqual({
      kind: "error",
      message: AUDIT_ERROR_MESSAGE,
    });
    expect(auditPageState({ loading: false, error: AUDIT_ERROR_MESSAGE, items: null })).not.toMatchObject({ empty: true });
    expect(auditPageState({ loading: false, error: null, items: [] })).toMatchObject({
      kind: "ready",
      empty: true,
      total: 0,
    });
    expect(AUDIT_EMPTY_TITLE).toBe("No audit events yet");
    expect(AUDIT_EMPTY_DESCRIPTION).toContain("activity");
  });
});
