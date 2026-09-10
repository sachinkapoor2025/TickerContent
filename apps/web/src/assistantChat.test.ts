import { describe, expect, it } from "vitest";
import { ASSISTANT_EMPTY_MESSAGE, ASSISTANT_SEND_ERROR, assistantSubmitState } from "./assistantChat.js";

describe("assistant send guard", () => {
  it("blocks an empty message", () => {
    expect(assistantSubmitState("", false)).toEqual({
      ok: false,
      reason: "empty",
      message: ASSISTANT_EMPTY_MESSAGE,
    });
    expect(assistantSubmitState("   ", false).ok).toBe(false);
  });

  it("prevents duplicate send while a request is in flight", () => {
    expect(assistantSubmitState("Hello", true)).toEqual({ ok: false, reason: "sending" });
  });

  it("uses honest send-failure copy", () => {
    expect(ASSISTANT_SEND_ERROR).toBe("Unable to send message. Please try again.");
  });
});
