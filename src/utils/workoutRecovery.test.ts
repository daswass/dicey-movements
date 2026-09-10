// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingWorkout, MAX_SAFE_WORKOUT_MULTIPLIER, restorePendingWorkout, savePendingWorkout } from "./workoutRecovery";

const workout = {
  id: "stable-workout-id",
  timestamp: 1_725_816_000_000,
  diceRoll: { exerciseDie: 2, repsDie: 5 },
  exercise: { id: 4, name: "Squats", splitId: "full-body" },
  reps: 25,
  multiplier: 1,
};

describe("pending workout recovery", () => {
  beforeEach(() => localStorage.clear());

  it("restores the same activity id after a reload so completion retries remain idempotent", () => {
    savePendingWorkout("user-a", workout);
    expect(restorePendingWorkout("user-a")).toEqual(workout);
    expect(restorePendingWorkout("user-b")).toBeNull();
  });

  it("clears a recovered workout only after the completion path is done", () => {
    savePendingWorkout("user-a", workout);
    clearPendingWorkout("user-a");
    expect(restorePendingWorkout("user-a")).toBeNull();
  });

  it("discards malformed stored data instead of presenting an invalid workout", () => {
    localStorage.setItem("dicey.pending-workout.user-a", "not-json");
    expect(restorePendingWorkout("user-a")).toBeNull();
    expect(localStorage.getItem("dicey.pending-workout.user-a")).toBeNull();
  });

  it("automatically discards a stale archive-sized multiplier", () => {
    savePendingWorkout("user-a", { ...workout, multiplier: MAX_SAFE_WORKOUT_MULTIPLIER + 1 });
    expect(restorePendingWorkout("user-a")).toBeNull();
    expect(localStorage.getItem("dicey.pending-workout.user-a")).toBeNull();
  });
});
