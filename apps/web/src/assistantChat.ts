export const ASSISTANT_EMPTY_MESSAGE = "Enter a message first.";
export const ASSISTANT_SEND_ERROR = "Unable to send message. Please try again.";

export function assistantSubmitState(text: unknown, sending: boolean) {
  if (sending) return { ok: false as const, reason: "sending" as const };
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false as const, reason: "empty" as const, message: ASSISTANT_EMPTY_MESSAGE };
  }
  return { ok: true as const, message: text.trim() };
}
