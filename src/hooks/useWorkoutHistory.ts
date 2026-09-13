import { useCallback, useEffect, useMemo, useState } from "react";
import { activitySyncService } from "../utils/activitySyncService";
import { supabase } from "../utils/supabaseClient";

export interface WorkoutActivity {
  id: string;
  user_id: string;
  timestamp: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number;
  dice_roll: {
    exerciseDie?: number;
    repsDie?: number;
  } | null;
}

/**
 * Multipliers are scoped to the active game session. Before the session boundary is loaded,
 * return an empty count rather than treating the complete activity archive as today. That makes
 * an early roll safe (1x) while the profile/history bootstrap finishes.
 */
export function countExercisesSinceSession(
  activities: WorkoutActivity[],
  lastSessionStart: Date | null
): Record<number, number> {
  if (!lastSessionStart) return {};

  const counts: Record<number, number> = {};
  for (const activity of activities) {
    if (new Date(activity.timestamp) > lastSessionStart) {
      counts[activity.exercise_id] = (counts[activity.exercise_id] || 0) + 1;
    }
  }
  return counts;
}

export function calculateTodayStats(activities: WorkoutActivity[], now: Date = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayActivities = activities.filter((activity) => new Date(activity.timestamp) >= startOfToday);
  const repsPerExerciseToday: Record<number, number> = {};

  todayActivities.forEach((activity) => {
    repsPerExerciseToday[activity.exercise_id] =
      (repsPerExerciseToday[activity.exercise_id] || 0) + activity.reps;
  });

  return {
    totalSetsToday: todayActivities.length,
    totalRepsToday: todayActivities.reduce((total, activity) => total + activity.reps, 0),
    repsPerExerciseToday,
  };
}

export function useWorkoutHistory(userId: string | undefined, isMaster: boolean) {
  const [history, setHistory] = useState<WorkoutActivity[]>([]);
  const [exerciseCounts, setExerciseCounts] = useState<Record<number, number>>({});
  const [lastSessionStart, setLastSessionStart] = useState<Date | null>(null);

  const fetchLastSessionStart = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("last_session_start")
      .eq("id", userId)
      .single();
    if (!error && data) {
      setLastSessionStart(data.last_session_start ? new Date(data.last_session_start) : null);
    }
  }, [userId]);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("useWorkoutHistory: Error fetching history:", error);
      return;
    }

    const activities = (data || []) as WorkoutActivity[];
    setHistory(activities);
    setExerciseCounts(countExercisesSinceSession(activities, lastSessionStart));
  }, [userId, lastSessionStart]);

  useEffect(() => {
    if (userId) fetchLastSessionStart();
  }, [userId, fetchLastSessionStart]);

  useEffect(() => {
    if (userId) fetchHistory();
  }, [userId, fetchHistory]);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = activitySyncService.subscribe(() => {
      if (!isMaster) {
        fetchHistory();
      }
    });

    return unsubscribe;
  }, [userId, fetchHistory, isMaster]);

  const sessionHistory = useMemo(
    () =>
      lastSessionStart
        ? history.filter((activity) => new Date(activity.timestamp) > lastSessionStart)
        : [],
    [lastSessionStart, history]
  );

  // Dashboard "Today" is calendar-based, not game-session-based. A missing or stale session
  // boundary must never hide an activity that was already saved today.
  const stats = useMemo(() => calculateTodayStats(history), [history]);

  return {
    history,
    setHistory,
    exerciseCounts,
    lastSessionStart,
    sessionHistory,
    stats,
    fetchHistory,
    fetchLastSessionStart,
  };
}
