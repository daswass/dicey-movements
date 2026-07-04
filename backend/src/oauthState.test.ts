import { createOuraOAuthState, verifyOuraOAuthState } from "./oauthState";

describe("oauthState", () => {
  const originalSecret = process.env.OURA_STATE_SECRET;

  beforeAll(() => {
    process.env.OURA_STATE_SECRET = "test-oauth-state-secret";
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.OURA_STATE_SECRET;
    } else {
      process.env.OURA_STATE_SECRET = originalSecret;
    }
  });

  it("round-trips a signed OAuth state for a user", () => {
    const state = createOuraOAuthState("user-123");
    expect(verifyOuraOAuthState(state)).toEqual({ userId: "user-123" });
  });

  it("rejects tampered signatures", () => {
    const state = createOuraOAuthState("user-123");
    const tampered = `${state.slice(0, -1)}x`;

    expect(() => verifyOuraOAuthState(tampered)).toThrow("Invalid OAuth state signature");
  });

  it("rejects expired state", () => {
    jest.useFakeTimers();
    const state = createOuraOAuthState("user-123");

    jest.advanceTimersByTime(11 * 60 * 1000);

    expect(() => verifyOuraOAuthState(state)).toThrow("OAuth state expired");
    jest.useRealTimers();
  });
});
