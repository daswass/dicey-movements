import { useCallback } from "react";
import { ExerciseMultipliers, WorkoutSession } from "../types";
import { UserProfile } from "../types/social";
import { AchievementService } from "../utils/achievementService";
import { api } from "../utils/api";
import { notificationService } from "../utils/notificationService";
import { getUserLocation } from "../utils/socialService";
import { supabase } from "../utils/supabaseClient";
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
  multipliers: ExerciseMultipliers;
  isCompletingWorkout: boolean;
  setIsCompletingWorkout: (value: boolean) => void;
  setWorkoutCompleteModal: (value: WorkoutCompleteModalState | null) => void;
  setCurrentWorkoutComplete: (value: boolean) => void;
  setTimerComplete: (value: boolean) => void;
  setLatestSession: (value: WorkoutSession | null) => void;
  setIsRollAndStartMode: (value: boolean) => void;
  setUnlockedAchievements: (value: string[]) => void;
  setUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
  setHistory: Dispatch<SetStateAction<import("./useWorkoutHistory").WorkoutActivity[]>>;
  fetchHistory: () => Promise<void>;
  resetNotificationFlags: () => void;
  onStartTimer: () => void;
}

export function useWorkoutComplete({
  userId,
  latestSession,
  multipliers,
  isCompletingWorkout,
  setIsCompletingWorkout,
  setWorkoutCompleteModal,
  setCurrentWorkoutComplete,
  setTimerComplete,
  setLatestSession,
  setIsRollAndStartMode,
  setUnlockedAchievements,
  setUserProfile,
  setHistory,
  fetchHistory,
  resetNotificationFlags,
  onStartTimer,
}: UseWorkoutCompleteOptions) {
  const handleWorkoutComplete = useCallback(async () => {
    if (isCompletingWorkout) return;
    if (!latestSession || !userId) return;

    setIsCompletingWorkout(true);

    const session = latestSession;
    const currentMultiplier = multipliers[session.exercise.id] || 1;
    let restartTimerId: ReturnType<typeof setTimeout>;

    const restartWorkout = () => {
      try {
        setWorkoutCompleteModal(null);
        setCurrentWorkoutComplete(false);
        setTimerComplete(false);
        sessionStorage.removeItem("openedFromNotification");
        resetNotificationFlags();
        onStartTimer();
        setLatestSession(null);
        setIsRollAndStartMode(false);
      } finally {
        setIsCompletingWorkout(false);
      }
    };

    const scheduleRestart = (delayMs: number) => {
      clearTimeout(restartTimerId);
      restartTimerId = setTimeout(restartWorkout, delayMs);
    };

    setWorkoutCompleteModal({});
    scheduleRestart(2000);

    notificationService.clearAllNotifications().catch((error) => {
      console.error("useWorkoutComplete: Error clearing notifications:", error);
    });
    notificationService.sendClearNotificationMessage("timer-notification").catch((error) => {
      console.error("useWorkoutComplete: Error clearing timer notification:", error);
    });

    void (async () => {
      try {
        const freshLocation = await getUserLocation({ fresh: true });
        const { zoneId, zoneInfo } = buildZoneFromLocation(freshLocation);

        if (zoneId && freshLocation.coordinates.latitude !== 0) {
          setUserProfile((prev) => (prev ? { ...prev, location: freshLocation } : null));
          supabase
            .from("profiles")
            .update({ location: freshLocation })
            .eq("id", userId)
            .then(({ error: locationError }) => {
              if (locationError) {
                console.error("useWorkoutComplete: Error updating profile location:", locationError);
              }
            });
        }

        let heistResult = null;
        if (zoneId && zoneInfo) {
          heistResult = await checkDiceHeist(zoneId, userId, session.reps, zoneInfo);
        }

        const newActivity = {
          id: crypto.randomUUID(),
          user_id: userId,
          timestamp: new Date().toISOString(),
          exercise_id: session.exercise.id,
          exercise_name: session.exercise.name,
          reps: session.reps,
          multiplier: currentMultiplier,
          dice_roll: session.diceRoll,
          zone_id: zoneId,
        };

        const { error } = await supabase.from("activities").insert(newActivity);
        if (error) {
          console.error("useWorkoutComplete: Error inserting activity:", error);
          setHistory((prevHistory) => prevHistory.slice(1));
          return;
        }

        if (heistResult) {
          const canNameZone = heistResult.becameSheister && heistResult.zoneIsUnnamed;
          if (heistResult.isHeist || canNameZone) {
            clearTimeout(restartTimerId);
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
            if (!canNameZone) {
              scheduleRestart(heistResult.isHeist ? 3500 : 2000);
            }
          }
        }

        await fetchHistory();

        try {
          const { data: updatedProfile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

          if (updatedProfile && !profileError) {
            setUserProfile({
              ...updatedProfile,
              timer_duration: updatedProfile.timer_duration || 300,
            });
          }
        } catch (profileError) {
          console.error("useWorkoutComplete: Error refreshing profile:", profileError);
        }

        try {
          const singleWorkoutAchievements =
            await AchievementService.checkSingleWorkoutAchievements(userId, session.reps);
          const generalAchievements = await AchievementService.checkAndUnlockAchievements(userId);
          const allNewAchievements = [...singleWorkoutAchievements, ...generalAchievements];
          if (allNewAchievements.length > 0) {
            setUnlockedAchievements(allNewAchievements);
          }
        } catch (error) {
          console.error("useWorkoutComplete: Error checking achievements:", error);
        }

        try {
          await api.completeWorkout(userId, session.exercise.name, session.reps, multipliers);
        } catch (error) {
          console.error("useWorkoutComplete: Error completing workout:", error);
        }
      } catch (error) {
        console.error("useWorkoutComplete: Background error:", error);
      }
    })();
  }, [
    isCompletingWorkout,
    latestSession,
    userId,
    multipliers,
    fetchHistory,
    setUserProfile,
    resetNotificationFlags,
    onStartTimer,
    setIsCompletingWorkout,
    setWorkoutCompleteModal,
    setCurrentWorkoutComplete,
    setTimerComplete,
    setLatestSession,
    setIsRollAndStartMode,
    setUnlockedAchievements,
    setHistory,
  ]);

  return handleWorkoutComplete;
}
