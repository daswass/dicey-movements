import { useCallback, useRef } from "react";
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
  isSaving?: boolean;
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
  userProfile: UserProfile | null;
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
  userProfile,
  setUserProfile,
  fetchHistory,
  resetNotificationFlags,
  onStartTimer,
}: UseWorkoutCompleteOptions) {
  // State updates do not synchronously disable a second click. Keep a ref as the authoritative
  // in-flight guard so one session UUID can produce at most one client completion attempt.
  const completionInFlightRef = useRef(false);

  const handleWorkoutComplete = useCallback(async () => {
    if (completionInFlightRef.current || isCompletingWorkout || !latestSession || !userId) return;

    const session = latestSession;
    completionInFlightRef.current = true;
    setIsCompletingWorkout(true);
    setCompletionError(null);
    // Give immediate feedback and keep the current session recoverable until the server accepts it.
    setWorkoutCompleteModal({ isSaving: true });

    // Location is authoritative for zone ownership but it is not needed to durably record the
    // exercise. Start it now and attach its result to this exact activity after the fast save.
    const freshLocationPromise = getUserLocation({ fresh: true })
      .then((freshLocation) => {
        if (freshLocation.coordinates.latitude === 0) return null;
        setUserProfile((previous) => (previous ? { ...previous, location: freshLocation } : null));
        void supabase
          .from("profiles")
          .update({ location: freshLocation })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) console.error("useWorkoutComplete: Error updating profile location:", error);
          });
        return freshLocation;
      })
      .catch((error) => {
        console.warn("useWorkoutComplete: Unable to refresh location:", error);
        return null;
      });

    let completion;
    try {
      completion = await api.completeWorkout({
        activityId: session.id,
        timestamp: new Date(session.timestamp).toISOString(),
        exerciseId: session.exercise.id,
        exerciseName: session.exercise.name,
        reps: session.reps,
        multiplier: session.multiplier,
        diceRoll: session.diceRoll,
        // The fresh zone is attached after this durable exercise insert. Never claim a zone
        // using stale profile location merely to make the save appear faster.
        zoneId: null,
      });

      // Only a request failure means the workout was not synced. Everything below is UI-only
      // post-commit work and must not make a durable completion look like it failed.
    } catch (error) {
      console.error("useWorkoutComplete: Error syncing workout completion:", error);
      const message = error instanceof Error ? error.message : "";
      setWorkoutCompleteModal(null);
      setCompletionError(
        message.startsWith("API 401:")
          ? "Your session expired. Reload Dicey, sign in if prompted, then retry this same workout."
          : "Workout was not synced. Retry to safely send the same workout."
      );
      completionInFlightRef.current = false;
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
    let hasRestarted = false;
    const restartWorkout = () => {
      if (hasRestarted) return;
      hasRestarted = true;
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
      completionInFlightRef.current = false;
      setIsCompletingWorkout(false);
    };
    const scheduleRestart = (delayMs: number) => {
      if (restartTimerId) clearTimeout(restartTimerId);
      restartTimerId = setTimeout(restartWorkout, delayMs);
    };
    const dismissHeist = () => {
      if (hasRestarted) {
        setWorkoutCompleteModal(null);
        return;
      }
      restartWorkout();
    };

    // Progress in place as soon as the durable write has acknowledged. Refreshes and derived
    // territory presentation happen in the background and must not make the exercise screen wait.
    setWorkoutCompleteModal({});
    scheduleRestart(2000);

    void (async () => {
      try {
        const freshLocation = await freshLocationPromise;
        const { zoneId, zoneInfo } = buildZoneFromLocation(freshLocation || undefined);
        if (completion.created && zoneId && zoneInfo) {
          const attachment = await api.attachActivityZone(session.id, zoneId);
          if (!attachment.attached) return;
          const heistResult = await checkDiceHeist(zoneId, userId, session.reps, zoneInfo);
          const canNameZone = heistResult.becameSheister && heistResult.zoneIsUnnamed;
          if (heistResult.isHeist || canNameZone) {
            if (!hasRestarted && restartTimerId) clearTimeout(restartTimerId);
            setWorkoutCompleteModal({
              heist: {
                zoneId: heistResult.zoneInfo.id,
                zoneName: heistResult.zoneInfo.displayName,
                previousCaptain: heistResult.previousCaptain,
                totalReps: heistResult.newTotalReps,
                isHeist: heistResult.isHeist,
                canNameZone,
              },
              // A slow heist check can finish after the next exercise begins. Keep the reward
              // visible in that case without replaying the already-restarted workout state.
              onDismiss: dismissHeist,
            });
            if (!canNameZone && !hasRestarted) scheduleRestart(heistResult.isHeist ? 3500 : 2000);
          }
        }

        void fetchHistory();
        const { data: updatedProfile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();
        if (updatedProfile && !profileError && !hasRestarted) {
          setUserProfile({ ...updatedProfile, timer_duration: updatedProfile.timer_duration || 300 });
        }
      } catch (error) {
        console.error("useWorkoutComplete: Post-completion refresh failed:", error);
      }
    })();
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
