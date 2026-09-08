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

    const currentExerciseCounts: Record<number, number> = {};
    const currentLastSessionStart = lastSessionStart;

    (data || []).forEach((activity) => {
      if (!currentLastSessionStart || new Date(activity.timestamp) > currentLastSessionStart) {
        currentExerciseCounts[activity.exercise_id] =
          (currentExerciseCounts[activity.exercise_id] || 0) + 1;
      }
    });

    setHistory(data || []);
    setExerciseCounts(currentExerciseCounts);
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

  const stats = useMemo(() => {
    if (!lastSessionStart) {
      return { totalSetsToday: 0, totalRepsToday: 0, repsPerExerciseToday: {} as Record<number, number> };
    }

    const todayActivities = history.filter(
      (activity) => new Date(activity.timestamp) > lastSessionStart
    );
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
  }, [history, lastSessionStart]);

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
