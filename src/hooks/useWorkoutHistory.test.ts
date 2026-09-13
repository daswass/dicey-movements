import { describe, expect, it, vi } from "vitest";

vi.mock("../utils/activitySyncService", () => ({
  activitySyncService: { subscribe: vi.fn(() => () => undefined) },
}));
vi.mock("../utils/supabaseClient", () => ({
  supabase: {},
}));
import { calculateTodayStats, countExercisesSinceSession, type WorkoutActivity } from "./useWorkoutHistory";

const activity = (id: string, exerciseId: number, timestamp: string): WorkoutActivity => ({
  id, user_id: "user", timestamp, exercise_id: exerciseId, exercise_name: "Pushup",
  reps: 6, multiplier: 1, dice_roll: { exerciseDie: exerciseId, repsDie: 6 },
});

describe("countExercisesSinceSession", () => {
  it("does not turn the full archive into a multiplier before the session boundary loads", () => {
    const activities = [
      activity("old-1", 1, "2026-09-08T12:00:00.000Z"),
      activity("old-2", 1, "2026-09-08T13:00:00.000Z"),
    ];
    expect(countExercisesSinceSession(activities, null)).toEqual({});
  });

  it("counts only activities after the current session starts", () => {
    const start = new Date("2026-09-09T04:00:00.000Z");
    const activities = [
      activity("old", 1, "2026-09-09T03:59:59.000Z"),
      activity("new-1", 1, "2026-09-09T04:01:00.000Z"),
      activity("new-2", 2, "2026-09-09T04:02:00.000Z"),
    ];
    expect(countExercisesSinceSession(activities, start)).toEqual({ 1: 1, 2: 1 });
  });
});

describe("calculateTodayStats", () => {
  it("counts saved calendar-day activities even when no session boundary exists", () => {
    const now = new Date(2026, 8, 13, 10, 0, 0);
    const today = new Date(2026, 8, 13, 0, 1, 0).toISOString();
    const yesterday = new Date(2026, 8, 12, 23, 59, 0).toISOString();
    const activities = [activity("today", 2, today), activity("yesterday", 2, yesterday)];

    expect(calculateTodayStats(activities, now)).toEqual({
      totalSetsToday: 1,
      totalRepsToday: 6,
      repsPerExerciseToday: { 2: 6 },
    });
  });
});
