import {
  attachActivityZone,
  drainRecoverableWorkoutCompletionEffects,
  recordWorkoutCompletion,
  runWorkoutCompletionEffects,
  validateActivityZoneAttachment,
  validateWorkoutCompletion,
} from "./workoutCompletionService";

const input = {
  activityId: "13e4d76e-8267-4dad-a361-ccdbe9ba5afd",
  timestamp: "2026-09-08T10:45:00.000Z",
  exerciseId: 2,
  exerciseName: "Pushup",
  reps: 24,
  multiplier: 4,
  diceRoll: { exerciseDie: 2, repsDie: 6 },
  zoneId: "zone-1",
};

describe("workout completion service", () => {
  it("validates the client UUID idempotency key and bounded workout values", () => {
    expect(() => validateWorkoutCompletion(input)).not.toThrow();
    expect(() => validateWorkoutCompletion({ ...input, activityId: "not-a-uuid" })).toThrow(
      "activityId must be a UUID"
    );
    expect(() => validateWorkoutCompletion({ ...input, reps: 0 })).toThrow(
      "reps must be a positive integer"
    );
  });

  it("records through the transactional RPC with the authenticated user, not a client user id", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ activity: { ...input, user_id: "authenticated-user" }, created: true }],
      error: null,
    });

    await expect(
      recordWorkoutCompletion({ rpc } as unknown as Parameters<typeof recordWorkoutCompletion>[0], "authenticated-user", input)
    ).resolves.toEqual({
      activity: { ...input, user_id: "authenticated-user" },
      created: true,
    });
    expect(rpc).toHaveBeenCalledWith("record_workout_completion", {
      p_activity_id: input.activityId,
      p_user_id: "authenticated-user",
      p_timestamp: input.timestamp,
      p_exercise_id: input.exerciseId,
      p_exercise_name: input.exerciseName,
      p_reps: input.reps,
      p_multiplier: input.multiplier,
      p_dice_roll: input.diceRoll,
      p_zone_id: input.zoneId,
    });
  });

  it("attaches a valid delayed zone through the owner-scoped RPC", async () => {
    const attachment = { activity: { ...input, user_id: "authenticated-user" }, attached: true };
    const rpc = jest.fn().mockResolvedValue({ data: [attachment], error: null });

    await expect(
      attachActivityZone(
        { rpc } as unknown as Parameters<typeof attachActivityZone>[0],
        "authenticated-user",
        { activityId: input.activityId, zoneId: "2037_-3699" }
      )
    ).resolves.toEqual(attachment);
    expect(rpc).toHaveBeenCalledWith("attach_activity_zone", {
      p_activity_id: input.activityId,
      p_user_id: "authenticated-user",
      p_zone_id: "2037_-3699",
    });
  });

  it("rejects malformed attachment identifiers before invoking the database", async () => {
    const rpc = jest.fn();
    expect(() => validateActivityZoneAttachment({ activityId: input.activityId, zoneId: "zone-1" })).toThrow(
      "zoneId must be a valid zone identifier"
    );
    expect(() => validateActivityZoneAttachment({ activityId: input.activityId, zoneId: "4501_0" })).toThrow(
      "zoneId must be a valid zone identifier"
    );
    await expect(
      attachActivityZone(
        { rpc } as unknown as Parameters<typeof attachActivityZone>[0],
        "authenticated-user",
        { activityId: input.activityId, zoneId: "not-a-zone" }
      )
    ).rejects.toThrow("zoneId must be a valid zone identifier");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not rerun post-commit effects when the effect row was already claimed", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: false, error: null });
    const from = jest.fn(() => {
      throw new Error("duplicate effects must not query or write side effects");
    });
    const push = {
      sendAchievementNotification: jest.fn(),
      sendFriendActivityNotification: jest.fn(),
    };

    await expect(
      runWorkoutCompletionEffects(
        { rpc, from } as unknown as Parameters<typeof runWorkoutCompletionEffects>[0],
        push,
        "authenticated-user",
        input
      )
    ).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("claim_workout_completion_effects", {
      p_activity_id: input.activityId,
      p_lease_token: expect.any(String),
      p_lease_seconds: 300,
    });
    expect(from).not.toHaveBeenCalled();
    expect(push.sendAchievementNotification).not.toHaveBeenCalled();
    expect(push.sendFriendActivityNotification).not.toHaveBeenCalled();
  });

  it("drains service-role recovery rows through the same leased effect path", async () => {
    const recoveryActivity = {
      id: input.activityId,
      user_id: "authenticated-user",
      timestamp: input.timestamp,
      exercise_id: input.exerciseId,
      exercise_name: input.exerciseName,
      reps: input.reps,
      multiplier: input.multiplier,
      dice_roll: input.diceRoll,
      zone_id: input.zoneId,
    };
    const rpc = jest.fn().mockImplementation((name: string) => {
      if (name === "list_recoverable_workout_completion_effects") {
        return Promise.resolve({ data: [{ activity: recoveryActivity }], error: null });
      }
      return Promise.resolve({ data: false, error: null });
    });
    const from = jest.fn(() => {
      throw new Error("an unclaimed recovery row must not execute effects");
    });
    const push = {
      sendAchievementNotification: jest.fn(),
      sendFriendActivityNotification: jest.fn(),
    };

    await expect(
      drainRecoverableWorkoutCompletionEffects(
        { rpc, from } as unknown as Parameters<typeof drainRecoverableWorkoutCompletionEffects>[0],
        push
      )
    ).resolves.toBe(1);
    expect(rpc).toHaveBeenNthCalledWith(1, "list_recoverable_workout_completion_effects", { p_limit: 100 });
    expect(rpc).toHaveBeenNthCalledWith(2, "claim_workout_completion_effects", {
      p_activity_id: input.activityId,
      p_lease_token: expect.any(String),
      p_lease_seconds: 300,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("shares an in-flight recovery drain instead of overlapping interval work", async () => {
    let resolveRecovery!: (value: { data: []; error: null }) => void;
    const rpc = jest.fn(
      () => new Promise<{ data: []; error: null }>((resolve) => { resolveRecovery = resolve; })
    );
    const db = { rpc } as unknown as Parameters<typeof drainRecoverableWorkoutCompletionEffects>[0];
    const push = {
      sendAchievementNotification: jest.fn(),
      sendFriendActivityNotification: jest.fn(),
    };

    const first = drainRecoverableWorkoutCompletionEffects(db, push);
    const second = drainRecoverableWorkoutCompletionEffects(db, push);
    expect(second).toBe(first);
    expect(rpc).toHaveBeenCalledTimes(1);

    resolveRecovery({ data: [], error: null });
    await expect(first).resolves.toBe(0);
  });
});
