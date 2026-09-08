import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken } = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("./authSession", () => ({ getAccessToken }));

import { api } from "./api";

const completion = {
  activityId: "13e4d76e-8267-4dad-a361-ccdbe9ba5afd",
  timestamp: "2026-09-08T10:45:00.000Z",
  exerciseId: 2,
  exerciseName: "Pushup",
  reps: 24,
  multiplier: 4,
  diceRoll: { exerciseDie: 2, repsDie: 6 },
  zoneId: "zone-1",
};

describe("api.completeWorkout", () => {
  beforeEach(() => {
    getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, created: true, activity: completion }) })
    );
  });

  it("sends the stable activity UUID as the completion idempotency key", async () => {
    await expect(api.completeWorkout(completion)).resolves.toMatchObject({ created: true });
    expect(fetch).toHaveBeenCalledWith(
      `${api.baseUrl}/api/workout/complete`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(completion),
        headers: expect.objectContaining({ Authorization: "Bearer access-token" }),
      })
    );
  });
});
