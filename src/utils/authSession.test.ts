import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccessToken,
  getAuthUserId,
  requireAuthUserId,
  syncAuthSession,
} from "./authSession";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession,
      getUser: vi.fn(),
    },
  },
}));

describe("authSession", () => {
  beforeEach(() => {
    syncAuthSession(null, null);
    getSession.mockReset();
  });

  it("returns cached user id after sync", () => {
    syncAuthSession("user-123", "token-abc");
    expect(getAuthUserId()).toBe("user-123");
  });

  it("returns cached access token without hitting supabase", async () => {
    syncAuthSession("user-123", "token-abc");
    await expect(getAccessToken()).resolves.toBe("token-abc");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("falls back to supabase session when token is not cached", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
    });

    await expect(getAccessToken()).resolves.toBe("fresh-token");
  });

  it("requireAuthUserId uses cached id", async () => {
    syncAuthSession("user-123", null);
    await expect(requireAuthUserId()).resolves.toBe("user-123");
  });
});
