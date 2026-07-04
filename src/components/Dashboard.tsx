import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getExerciseById, getSplitById, getDefaultSplit } from "../data/exercises";
import { ExerciseMultipliers, WorkoutSession, Split, Exercise } from "../types";
import { UserProfile } from "../types/social";
import { useTimerMasterStatus } from "../hooks/useTimerMasterStatus";
import { useWorkoutComplete } from "../hooks/useWorkoutComplete";
import { useWorkoutHistory } from "../hooks/useWorkoutHistory";
import { api } from "../utils/api";
import { notificationService } from "../utils/notificationService";
import { supabase } from "../utils/supabaseClient";
import { AchievementNotification } from "./AchievementNotification";
import { Achievements } from "./Achievements";
import ExerciseInstructionsModal from "./ExerciseInstructionsModal";
import History from "./History";
import SettingsPanel from "./SettingsPanel";
import SocialFeatures from "./SocialFeatures";
import WorkoutFlow from "./WorkoutFlow";
import {
  WorkoutCompleteHeistInfo,
  WorkoutCompleteModal,
} from "./WorkoutCompleteModal";

interface DashboardProps {
  timerComplete: boolean;
  setTimerComplete: (complete: boolean) => void;
  currentWorkoutComplete: boolean;
  setCurrentWorkoutComplete: (complete: boolean) => void;
  onStartTimer: () => void;
  onResetTimerToDuration: (newDuration: number) => void;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  resetNotificationFlags: () => void;
}

const Dashboard: React.FC<DashboardProps> = React.memo(
  ({
    timerComplete,
    setTimerComplete,
    currentWorkoutComplete,
    setCurrentWorkoutComplete,
    onStartTimer,
    onResetTimerToDuration,
    userProfile,
    setUserProfile,
    resetNotificationFlags,
  }) => {
    const userId = userProfile?.id;
    const isMaster = useTimerMasterStatus();
    const {
      history,
      setHistory,
      exerciseCounts,
      lastSessionStart,
      sessionHistory,
      stats,
      fetchHistory,
      fetchLastSessionStart,
    } = useWorkoutHistory(userId, isMaster);

    const [selectedSplit, setSelectedSplit] = useState<Split>(getDefaultSplit());
    const multipliers: ExerciseMultipliers = useMemo(() => {
      const calculatedMultipliers: ExerciseMultipliers = {};
      for (let i = 1; i <= 6; i++) {
        calculatedMultipliers[i] = (exerciseCounts[i] || 0) + 1;
      }
      return calculatedMultipliers;
    }, [exerciseCounts]);

    const [latestSession, setLatestSession] = useState<WorkoutSession | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [workoutCompleteModal, setWorkoutCompleteModal] = useState<{
      heist?: WorkoutCompleteHeistInfo;
    } | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState<{
      show: boolean;
      type: "game" | "multipliers" | null;
    }>({ show: false, type: null });
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
    const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
    const [showAchievements, setShowAchievements] = useState(false);
    const [isRollAndStartMode, setIsRollAndStartMode] = useState(false);
    const [isCompletingWorkout, setIsCompletingWorkout] = useState(false);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [showSplitsPanel, setShowSplitsPanel] = useState(false);

    const stableUserProfile = useMemo(
      () => userProfile,
      [userProfile?.id, userProfile?.timer_duration, userProfile?.notifications_enabled]
    );

    useEffect(() => {
      if (userProfile?.user_split_id) {
        try {
          setSelectedSplit(getSplitById(userProfile.user_split_id));
        } catch (error) {
          console.error("Dashboard: Error loading user split:", error);
          setSelectedSplit(getDefaultSplit());
        }
      }
    }, [userProfile?.user_split_id]);

    const handleTimerComplete = useCallback(() => {
      setTimerComplete(true);
      setCurrentWorkoutComplete(false);
    }, [setTimerComplete, setCurrentWorkoutComplete]);

    const handleRollAndStart = useCallback(async () => {
      console.log("Dashboard: Roll and Start button clicked");
      if (latestSession) {
        try {
          await api.completeWorkout(
            userId,
            latestSession.exercise.name,
            latestSession.reps,
            multipliers
          );
          await fetchHistory();
        } catch (error) {
          console.error("Error completing workout:", error);
        }
      }

      setCurrentWorkoutComplete(false);
      setTimerComplete(false);
      // Clear notification flags for new timer session
      sessionStorage.removeItem("openedFromNotification");
      resetNotificationFlags();
      setLatestSession(null);
      setIsRollAndStartMode(true); // Enable roll and start mode to trigger dice rolling
    }, [
      latestSession,
      userId,
      multipliers,
      fetchHistory,
      setUserProfile,
      resetNotificationFlags,
    ]);

    const handleWorkoutComplete = useWorkoutComplete({
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
    });

    const resetAll = useCallback(async () => {
      console.log("Dashboard: Resetting all game state.");

      // Clear timer notifications when resetting
      try {
        notificationService.clearAllNotifications(); // Clear all notifications first
        await notificationService.sendClearNotificationMessage("timer-notification");
      } catch (error) {
        console.error("Dashboard: Error clearing notifications on reset:", error);
      }

      setLatestSession(null);
      setCurrentWorkoutComplete(false);
      setTimerComplete(false);
      // Clear notification flags for new timer session
      sessionStorage.removeItem("openedFromNotification");
      resetNotificationFlags();
      setIsRollAndStartMode(false); // Reset roll and start mode

      // Reset timer to full duration when day rolls
      if (userProfile?.timer_duration) {
        console.log("Dashboard: Resetting timer to full duration:", userProfile.timer_duration);
        onResetTimerToDuration(userProfile.timer_duration);
      }

      // Clear timer sync fields and update last session start
      const { error } = await supabase
        .from("profiles")
        .update({
          last_session_start: new Date().toISOString(),
          timer_master_device_id: null,
          timer_start_time: null,
          timer_last_updated: new Date().toISOString(),
        })
        .eq("id", userId);
      if (!error) {
        await fetchLastSessionStart();
        await fetchHistory();
      } else {
        console.error("Dashboard: Error updating last_session_start:", error);
      }
    }, [
      userId,
      userProfile?.timer_duration,
      onResetTimerToDuration,
      fetchLastSessionStart,
      fetchHistory,
      setLatestSession,
      setCurrentWorkoutComplete,
      setTimerComplete,
      resetNotificationFlags,
    ]);

    // Check if app was opened from notification
    useEffect(() => {
      const openedFromNotification = sessionStorage.getItem("openedFromNotification");
      if (openedFromNotification === "true") {
        // Don't auto-start timer if opened from notification
        // Don't clear the flag here - let it be cleared when actually used
        return;
      }
    }, []);

    // useEffect for auto-reset on date change using setInterval
    useEffect(() => {
      const checkAndReset = () => {
        // Don't auto-reset if opened from notification
        const openedFromNotification = sessionStorage.getItem("openedFromNotification");
        if (openedFromNotification === "true") {
          // Don't clear the flag here - let it be cleared when actually used
          return;
        }

        if (userId && lastSessionStart) {
          const today = new Date();
          const lastSessionDate = new Date(
            lastSessionStart.getFullYear(),
            lastSessionStart.getMonth(),
            lastSessionStart.getDate()
          );
          const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          if (lastSessionDate.getTime() < todayDate.getTime()) {
            console.log("Dashboard: Date has changed since last session. Auto-resetting game.");
            resetAll();
          }
        }
      };

      checkAndReset();

      const intervalId = setInterval(checkAndReset, 60000);
      return () => {
        clearInterval(intervalId);
      };
    }, [userId, lastSessionStart, resetAll]);

    const handleResetClick = useCallback((type: "game" | "multipliers") => {
      setShowConfirmModal({ show: true, type });
    }, []);

    const handleConfirmReset = useCallback(() => {
      if (showConfirmModal.type === "game") {
        resetAll();
      }
      setShowConfirmModal({ show: false, type: null });
    }, [showConfirmModal.type, resetAll]);

    const handleCancelReset = useCallback(() => {
      setShowConfirmModal({ show: false, type: null });
    }, []);

    const handleDiceRoll = useCallback(
      (session: WorkoutSession) => {
        setCurrentWorkoutComplete(false);
        setLatestSession(session);

        if (isRollAndStartMode) {
          setIsRollAndStartMode(false);
        }
      },
      [isRollAndStartMode]
    );

    const updateNotificationsEnabled = useCallback(
      async (enabled: boolean) => {
        setNotificationsEnabled(enabled);
        if (userId) {
          const { error } = await supabase
            .from("profiles")
            .update({ notifications_enabled: enabled })
            .eq("id", userId);
          if (error) {
            console.error("Dashboard: Error updating notifications_enabled:", error);
          } else {
            setUserProfile((prev) => (prev ? { ...prev, notifications_enabled: enabled } : null));
          }
        }
      },
      [userId, setUserProfile]
    );

    const updateTimerDuration = useCallback(
      async (newDuration: number) => {
        console.log("Dashboard: updateTimerDuration received newDuration:", newDuration);

        // Update local state immediately for instant UI response
        setUserProfile((prev) => (prev ? { ...prev, timer_duration: newDuration } : null));

        // Reset timer to new duration immediately
        onResetTimerToDuration(newDuration);

        // Clear timer notifications when changing duration
        try {
          notificationService.clearAllNotifications(); // Clear all notifications first
          await notificationService.sendClearNotificationMessage("timer-notification");
        } catch (error) {
          console.error("Dashboard: Error clearing notifications on duration change:", error);
        }

        // Update database in the background
        if (userId) {
          const { error } = await supabase
            .from("profiles")
            .update({ timer_duration: newDuration })
            .eq("id", userId);
          if (error) {
            console.error("Dashboard: Error updating timer_duration in DB:", error);
          }
        }
      },
      [userId, onResetTimerToDuration, setUserProfile]
    );

    const handleSplitChange = useCallback(
      async (newSplitId: string) => {
        console.log("handleSplitChange: Changing to split:", newSplitId);
        const newSplit = getSplitById(newSplitId);
        console.log("handleSplitChange: Got split:", newSplit);
        setSelectedSplit(newSplit);
        console.log("handleSplitChange: Updated selectedSplit state");

        // Update local state
        setUserProfile((prev) => (prev ? { ...prev, user_split_id: newSplitId } : null));

        // Save to database
        if (userId) {
          try {
            const { error } = await supabase
              .from("profiles")
              .update({ user_split_id: newSplitId })
              .eq("id", userId);

            if (error) {
              console.error("Error updating user split:", error);
            } else {
              console.log("handleSplitChange: Successfully updated database");
            }
          } catch (error) {
            console.error("Error updating user split:", error);
          }
        }
      },
      [setUserProfile, userId]
    );

    const handleExerciseClick = useCallback((exercise: Exercise) => {
      setSelectedExercise(exercise);
      setShowExerciseModal(true);
    }, []);

    if (!userId) {
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            <WorkoutFlow
              timerComplete={timerComplete}
              currentWorkoutComplete={currentWorkoutComplete}
              isRollAndStartMode={isRollAndStartMode}
              latestSession={latestSession}
              userProfile={userProfile}
              timerDuration={stableUserProfile?.timer_duration}
              multipliers={multipliers}
              selectedSplit={selectedSplit}
              isMaster={isMaster}
              isCompletingWorkout={isCompletingWorkout}
              showSettings={showSettings}
              showSplitsPanel={showSplitsPanel}
              onToggleSettings={() => setShowSettings(!showSettings)}
              onToggleSplitsPanel={() => setShowSplitsPanel(!showSplitsPanel)}
              onTimerComplete={handleTimerComplete}
              onRollAndStart={handleRollAndStart}
              onDiceRoll={handleDiceRoll}
              onSplitChange={(splitId) => {
                handleSplitChange(splitId);
                setShowSplitsPanel(false);
              }}
              onWorkoutComplete={handleWorkoutComplete}
            />
            <History history={sessionHistory as any[]} selectedSplit={selectedSplit} />
            {showAchievements && <Achievements userProfile={userProfile} />}
          </div>

          <div className="col-span-1 space-y-6">
            <SocialFeatures />
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-3">
                  <h3 className="text-xl font-semibold">Stats</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>•</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {selectedSplit.name}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowAchievements(!showAchievements)}
                    className="px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
                    {showAchievements ? "Hide" : ""} Achievements
                  </button>
                  <button
                    onClick={() => handleResetClick("game")}
                    className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                    Reset Day
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Today:</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Sets</h4>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {stats.totalSetsToday}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Reps</h4>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {stats.totalRepsToday}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                      Streak:
                    </h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                      Current
                    </h4>
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      {userProfile?.stats?.streak || 0} days
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
                      Longest
                    </h4>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {userProfile?.stats?.longestStreak || 0} days
                    </span>
                  </div>
                </div>
              </div>

              <h4 className="text-md font-medium mb-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                Exercises:
              </h4>
              <div className="space-y-2">
                {Object.entries(multipliers).map(([exerciseId, multiplier]) => {
                  const exercise = getExerciseById(Number(exerciseId), selectedSplit.id);
                  const repsToday = stats.repsPerExerciseToday[Number(exerciseId)] || 0;
                  return (
                    <div
                      key={exerciseId}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      {/* Exercise Name (stays on the left) */}
                      <button
                        onClick={() => handleExerciseClick(exercise)}
                        className="truncate text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left flex-1"
                        title={`Click to see instructions for ${exercise.name}`}>
                        {exercise.name}
                      </button>

                      {/* NEW: A flex container for the stats on the right */}
                      <div className="flex items-baseline gap-x-4">
                        <span className="w-20 text-right text-sm text-gray-600 dark:text-gray-300">
                          Reps:{" "}
                          <b>
                            <i>{repsToday}</i>
                          </b>
                        </span>
                        <span className="w-8 text-right font-semibold text-blue-600 dark:text-blue-400">
                          {multiplier}x
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Achievement Notifications */}
        {unlockedAchievements.map((achievementId, index) => (
          <AchievementNotification
            key={`${achievementId}-${index}`}
            achievementId={achievementId}
            index={index}
            onClose={() => {
              setUnlockedAchievements((prev) => prev.filter((id) => id !== achievementId));
            }}
          />
        ))}

        {showSettings && stableUserProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                &times;
              </button>
              <SettingsPanel
                timerDuration={stableUserProfile?.timer_duration}
                updateTimerDuration={updateTimerDuration}
                notificationsEnabled={notificationsEnabled}
                updateNotificationsEnabled={updateNotificationsEnabled}
                userProfile={stableUserProfile}
                onClose={() => setShowSettings(false)}
                onUserProfileUpdate={(updatedProfile) => {
                  setUserProfile(updatedProfile);
                }}
              />
            </div>
          </div>
        )}

        {workoutCompleteModal && (
          <WorkoutCompleteModal heist={workoutCompleteModal.heist} />
        )}

        {showConfirmModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full">
              <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                Reset Day?
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                {showConfirmModal.type === "game"
                  ? "This will reset today's game progress, including multipliers and history."
                  : "This will reset all exercise multipliers to 1x."}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelReset}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Instructions Modal */}
        <ExerciseInstructionsModal
          exercise={selectedExercise}
          isOpen={showExerciseModal}
          onClose={() => setShowExerciseModal(false)}
        />
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function to prevent unnecessary re-renders
    // Only re-render if these critical props change
    return (
      prevProps.timerComplete === nextProps.timerComplete &&
      prevProps.currentWorkoutComplete === nextProps.currentWorkoutComplete &&
      prevProps.userProfile?.id === nextProps.userProfile?.id &&
      prevProps.userProfile?.timer_duration === nextProps.userProfile?.timer_duration &&
      prevProps.userProfile?.notifications_enabled === nextProps.userProfile?.notifications_enabled
    );
  }
);

export default Dashboard;
