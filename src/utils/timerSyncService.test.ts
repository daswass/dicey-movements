// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdate = vi.fn();
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockEq = vi.fn();

vi.mock("./authSession", () => ({
  getAuthUserId: vi.fn(() => "user-123"),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock("./supabaseChannel", () => ({
  createSupabaseChannel: () => ({
    subscribe: vi.fn(),
    getStatus: () => ({ isConnected: false, reconnectAttempts: 0 }),
    temporarilyDisconnect: vi.fn(),
    cleanup: vi.fn(),
  }),
}));

describe("timerSyncService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillText: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,test");
  });

  it("resetTimerSync clears master device and start time", async () => {
    const { timerSyncService } = await import("./timerSyncService");

    const result = await timerSyncService.resetTimerSync();

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        timer_master_device_id: null,
        timer_start_time: null,
      })
    );
    expect(mockEq).toHaveBeenCalledWith("id", "user-123");
  });
});
