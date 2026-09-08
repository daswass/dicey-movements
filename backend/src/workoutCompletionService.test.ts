import {
  recordWorkoutCompletion,
  runWorkoutCompletionEffects,
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
    });
    expect(from).not.toHaveBeenCalled();
    expect(push.sendAchievementNotification).not.toHaveBeenCalled();
    expect(push.sendFriendActivityNotification).not.toHaveBeenCalled();
  });
});
