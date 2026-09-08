import type { WorkoutSession } from "../types";

const storageKey = (userId: string) => `dicey.pending-workout.${userId}`;

function isWorkoutSession(value: unknown): value is WorkoutSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<WorkoutSession>;
  return (
    typeof session.id === "string" &&
    typeof session.timestamp === "number" &&
    typeof session.reps === "number" &&
    typeof session.multiplier === "number" &&
    !!session.exercise &&
    typeof session.exercise.id === "number" &&
    !!session.diceRoll &&
    typeof session.diceRoll.exerciseDie === "number" &&
    typeof session.diceRoll.repsDie === "number"
  );
}

export function savePendingWorkout(userId: string, session: WorkoutSession): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(session));
}

export function restorePendingWorkout(userId: string): WorkoutSession | null {
  const stored = localStorage.getItem(storageKey(userId));
  if (!stored) return null;

  try {
    const session: unknown = JSON.parse(stored);
    if (isWorkoutSession(session)) return session;
  } catch {
    // Invalid local recovery data must not block the workout screen.
  }

  localStorage.removeItem(storageKey(userId));
  return null;
}

export function clearPendingWorkout(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}
