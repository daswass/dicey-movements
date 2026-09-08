import { createHmac } from "crypto";
import {
  isValidOuraWebhookSignature,
  OuraWebhookReplayProtector,
  parseOuraWebhookEvent,
} from "./ouraWebhook";
import { isValidOuraWebhookToken } from "./webhookAuth";

const rawBody = Buffer.from(
  JSON.stringify({
    event_type: "create",
    data_type: "daily_activity",
    event_datetime: "2026-09-08T10:00:00Z",
    object_id: "activity-123",
    user_id: "oura-user-123",
  })
);

const event = JSON.parse(rawBody.toString());

describe("Oura webhook verification", () => {
  it("accepts a correctly signed raw body", () => {
    const signature = createHmac("sha256", "client-secret").update(rawBody).digest("hex");
    expect(isValidOuraWebhookSignature(rawBody, signature, "client-secret")).toBe(true);
  });

  it("rejects a missing secret, malformed signature, or signature for a different raw body", () => {
    expect(isValidOuraWebhookSignature(rawBody, undefined, "client-secret")).toBe(false);
    expect(isValidOuraWebhookSignature(rawBody, "not-a-signature", "client-secret")).toBe(false);
    expect(isValidOuraWebhookSignature(Buffer.from("{}"), "a".repeat(64), undefined)).toBe(false);
  });

  it("requires an exact verification token", () => {
    expect(isValidOuraWebhookToken("expected-token", "expected-token")).toBe(true);
    expect(isValidOuraWebhookToken("wrong-token", "expected-token")).toBe(false);
    expect(isValidOuraWebhookToken("expected-token", undefined)).toBe(false);
  });
});

describe("Oura webhook payload handling", () => {
  it("accepts a supported, complete event", () => {
    expect(parseOuraWebhookEvent(event)).toEqual(event);
  });

  it.each([
    [{ ...event, data_type: "sleep" }],
    [{ ...event, event_datetime: "not-a-date" }],
    [{ ...event, user_id: "" }],
    [{ ...event, object_id: 7 }],
    [{}],
  ])("rejects malformed or unsupported payloads", (payload) => {
    expect(parseOuraWebhookEvent(payload)).toBeNull();
  });

  it("rejects duplicate deliveries during the replay window", () => {
    const protector = new OuraWebhookReplayProtector(1_000);
    const parsed = parseOuraWebhookEvent(event)!;

    expect(protector.isReplay(parsed, 100)).toBe(false);
    expect(protector.isReplay(parsed, 200)).toBe(true);
    expect(protector.isReplay(parsed, 1_101)).toBe(false);
  });
});
