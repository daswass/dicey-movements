import { useCallback } from "react";
import { WorkoutSession } from "../types";
import { UserProfile } from "../types/social";
import { api } from "../utils/api";
import { notificationService } from "../utils/notificationService";
import { getUserLocation } from "../utils/socialService";
import { supabase } from "../utils/supabaseClient";
import { clearPendingWorkout } from "../utils/workoutRecovery";
import { buildZoneFromLocation, checkDiceHeist } from "../utils/zoneService";
import type { Dispatch, SetStateAction } from "react";
import { WorkoutCompleteHeistInfo } from "../components/WorkoutCompleteModal";

export interface WorkoutCompleteModalState {
  heist?: WorkoutCompleteHeistInfo;
  onDismiss?: () => void;
}

interface UseWorkoutCompleteOptions {
  userId: string | undefined;
  latestSession: WorkoutSession | null;
  isCompletingWorkout: boolean;
  setIsCompletingWorkout: (value: boolean) => void;
  setCompletionError: (value: string | null) => void;
  setWorkoutCompleteModal: (value: WorkoutCompleteModalState | null) => void;
  setCurrentWorkoutComplete: (value: boolean) => void;
  setTimerComplete: (value: boolean) => void;
  setLatestSession: (value: WorkoutSession | null) => void;
  setIsRollAndStartMode: (value: boolean) => void;
  setUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
  fetchHistory: () => Promise<void>;
  resetNotificationFlags: () => void;
  onStartTimer: () => void;
}

/**
 * A rolled session owns its UUID. Keeping it in latestSession until the backend accepts it makes
 * retries idempotent: a timeout replays the same activity rather than creating another workout.
 */
export function useWorkoutComplete({
  userId,
  latestSession,
  isCompletingWorkout,
  setIsCompletingWorkout,
  setCompletionError,
  setWorkoutCompleteModal,
  setCurrentWorkoutComplete,
  setTimerComplete,
  setLatestSession,
  setIsRollAndStartMode,
  setUserProfile,
  fetchHistory,
  resetNotificationFlags,
  onStartTimer,
}: UseWorkoutCompleteOptions) {
  const handleWorkoutComplete = useCallback(async () => {
    if (isCompletingWorkout || !latestSession || !userId) return;

    const session = latestSession;
    setIsCompletingWorkout(true);
    setCompletionError(null);

    let completion;
    let zoneId: string | null = null;
    let zoneInfo: ReturnType<typeof buildZoneFromLocation>["zoneInfo"] = null;
    try {
      try {
        const freshLocation = await getUserLocation({ fresh: true });
        ({ zoneId, zoneInfo } = buildZoneFromLocation(freshLocation));
        if (zoneId && freshLocation.coordinates.latitude !== 0) {
          setUserProfile((previous) => (previous ? { ...previous, location: freshLocation } : null));
          void supabase
            .from("profiles")
            .update({ location: freshLocation })
            .eq("id", userId)
            .then(({ error }) => {
              if (error) console.error("useWorkoutComplete: Error updating profile location:", error);
            });
        }
      } catch (error) {
        // Location enriches a workout but must never stop a durable completion from retrying.
        console.warn("useWorkoutComplete: Unable to refresh location:", error);
      }

      completion = await api.completeWorkout({
        activityId: session.id,
        timestamp: new Date(session.timestamp).toISOString(),
        exerciseId: session.exercise.id,
        exerciseName: session.exercise.name,
        reps: session.reps,
        multiplier: session.multiplier,
        diceRoll: session.diceRoll,
        zoneId,
      });

      // Only a request failure means the workout was not synced. Everything below is UI-only
      // post-commit work and must not make a durable completion look like it failed.
    } catch (error) {
      console.error("useWorkoutComplete: Error syncing workout completion:", error);
      setCompletionError("Workout was not synced. Retry to safely send the same workout.");
      setIsCompletingWorkout(false);
      return;
    }

    // The server has committed the activity. Only now clear the device's timer notification and
    // run UI-only post-completion work. A duplicate response is still safe to finish locally.
    notificationService.clearAllNotifications().catch((error) => {
      console.error("useWorkoutComplete: Error clearing notifications:", error);
    });
    notificationService.sendClearNotificationMessage("timer-notification").catch((error) => {
      console.error("useWorkoutComplete: Error clearing timer notification:", error);
    });

    let restartTimerId: ReturnType<typeof setTimeout> | undefined;
    const restartWorkout = () => {
      if (restartTimerId) clearTimeout(restartTimerId);
      setWorkoutCompleteModal(null);
      setCurrentWorkoutComplete(false);
      setTimerComplete(false);
      sessionStorage.removeItem("openedFromNotification");
      resetNotificationFlags();
      onStartTimer();
      clearPendingWorkout(userId);
      setLatestSession(null);
      setIsRollAndStartMode(false);
      setIsCompletingWorkout(false);
    };
    const scheduleRestart = (delayMs: number) => {
      if (restartTimerId) clearTimeout(restartTimerId);
      restartTimerId = setTimeout(restartWorkout, delayMs);
    };

    let heistResult = null;
    try {
      // Derived territory effects and refreshed UI data are non-critical after the server has
      // accepted the workout. They may be retried on the next load without replaying activity.
      if (completion.created && zoneId && zoneInfo) {
        heistResult = await checkDiceHeist(zoneId, userId, session.reps, zoneInfo);
      }

      await fetchHistory();
      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (updatedProfile && !profileError) {
        setUserProfile({ ...updatedProfile, timer_duration: updatedProfile.timer_duration || 300 });
      }
    } catch (error) {
      console.error("useWorkoutComplete: Post-completion refresh failed:", error);
    }

    if (heistResult) {
      const canNameZone = heistResult.becameSheister && heistResult.zoneIsUnnamed;
      if (heistResult.isHeist || canNameZone) {
        setWorkoutCompleteModal({
          heist: {
            zoneId: heistResult.zoneInfo.id,
            zoneName: heistResult.zoneInfo.displayName,
            previousCaptain: heistResult.previousCaptain,
            totalReps: heistResult.newTotalReps,
            isHeist: heistResult.isHeist,
            canNameZone,
          },
          onDismiss: restartWorkout,
        });
        if (!canNameZone) scheduleRestart(heistResult.isHeist ? 3500 : 2000);
        return;
      }
    }

    setWorkoutCompleteModal({});
    scheduleRestart(2000);
  }, [
    isCompletingWorkout,
    latestSession,
    userId,
    fetchHistory,
    onStartTimer,
    resetNotificationFlags,
    setCompletionError,
    setCurrentWorkoutComplete,
    setIsCompletingWorkout,
    setIsRollAndStartMode,
    setLatestSession,
    setTimerComplete,
    setUserProfile,
    setWorkoutCompleteModal,
  ]);

  return handleWorkoutComplete;
}
