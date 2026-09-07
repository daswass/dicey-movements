import { isValidOuraWebhookToken } from "./webhookAuth";

describe("isValidOuraWebhookToken", () => {
  it("accepts the configured token", () => {
    expect(isValidOuraWebhookToken("expected-token", "expected-token")).toBe(true);
  });

  it.each([
    ["wrong-token", "expected-token"],
    ["short", "expected-token"],
    [undefined, "expected-token"],
    [123, "expected-token"],
    ["expected-token", undefined],
  ])("rejects an invalid or unavailable token", (supplied, expected) => {
    expect(isValidOuraWebhookToken(supplied, expected)).toBe(false);
  });
});
