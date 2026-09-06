// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { subscribe } = vi.hoisted(() => ({
  subscribe: vi.fn(),
}));

vi.mock("./supabaseChannel", () => ({
  SUPABASE_CHANNEL_STATUS: { SUBSCRIBED: "SUBSCRIBED" },
  createSupabaseChannel: () => ({
    subscribe,
    disconnect: vi.fn(),
    cleanup: vi.fn(),
    getStatus: () => ({ isConnected: false, reconnectAttempts: 0 }),
  }),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {},
}));

describe("activitySyncService", () => {
  beforeEach(() => {
    subscribe.mockClear();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("refreshes listeners for inserts and updates to activity tables", async () => {
    const { activitySyncService } = await import("./activitySyncService");

    const unsubscribeActivity = activitySyncService.subscribe(vi.fn());
    const unsubscribeOura = activitySyncService.subscribeToOura(vi.fn());

    expect(subscribe).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "activities" },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "oura_activities" },
      expect.any(Function)
    );

    unsubscribeActivity();
    unsubscribeOura();
  });
});
