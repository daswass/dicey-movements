import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { getSplitById, getDefaultSplit } from "../data/exercises";
import { ExerciseMultipliers, WorkoutSession, Split, Exercise } from "../types";
import { UserProfile } from "../types/social";
import { useProfileSettings } from "../hooks/useProfileSettings";
import { useTimerMasterStatus } from "../hooks/useTimerMasterStatus";
import { useWorkoutComplete } from "../hooks/useWorkoutComplete";
import { useWorkoutHistory } from "../hooks/useWorkoutHistory";
import { notificationService } from "../utils/notificationService";
import { supabase } from "../utils/supabaseClient";
import { clearPendingWorkout, restorePendingWorkout, savePendingWorkout } from "../utils/workoutRecovery";
import DashboardModals from "./DashboardModals";
import DashboardStatsPanel from "./DashboardStatsPanel";
import History from "./History";
import SocialFeatures from "./SocialFeatures";
import WorkoutFlow from "./WorkoutFlow";
import type { WorkoutCompleteModalState } from "../hooks/useWorkoutComplete";

const Achievements = lazy(() =>
  import("./Achievements").then((module) => ({ default: module.Achievements }))
);

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
      exerciseCounts,
      lastSessionStart,
      sessionHistory,
      stats,
      fetchHistory,
      fetchLastSessionStart,
    } = useWorkoutHistory(userId, isMaster);

    const {
      notificationsEnabled,
      updateNotificationsEnabled,
      updateTimerDuration,
      handleSplitChange: saveSplitChange,
    } = useProfileSettings({
      userId,
      userProfile,
      setUserProfile,
      onResetTimerToDuration,
    });

    const [selectedSplit, setSelectedSplit] = useState<Split>(getDefaultSplit());
    const multipliers: ExerciseMultipliers = useMemo(() => {
      const calculatedMultipliers: ExerciseMultipliers = {};
      for (let i = 1; i <= 6; i++) {
        calculatedMultipliers[i] = (exerciseCounts[i] || 0) + 1;
      }
      return calculatedMultipliers;
    }, [exerciseCounts]);

    const [latestSession, setLatestSession] = useState<WorkoutSession | null>(null);

    useEffect(() => {
      setLatestSession(userId ? restorePendingWorkout(userId) : null);
    }, [userId]);
    const [showSettings, setShowSettings] = useState(false);
    const [workoutCompleteModal, setWorkoutCompleteModal] = useState<WorkoutCompleteModalState | null>(
      null
    );
    const [showConfirmModal, setShowConfirmModal] = useState<{
      show: boolean;
      type: "game" | "multipliers" | null;
    }>({ show: false, type: null });
    const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
    const [showAchievements, setShowAchievements] = useState(false);
    const [isRollAndStartMode, setIsRollAndStartMode] = useState(false);
    const [isCompletingWorkout, setIsCompletingWorkout] = useState(false);
    const [completionError, setCompletionError] = useState<string | null>(null);
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

    const handleRollAndStart = useCallback(() => {
      console.log("Dashboard: Roll and Start button clicked");

      setCurrentWorkoutComplete(false);
      setTimerComplete(false);
      // Clear notification flags for new timer session
      sessionStorage.removeItem("openedFromNotification");
      resetNotificationFlags();
      setLatestSession(null);
      if (userId) clearPendingWorkout(userId);
      setIsRollAndStartMode(true); // Enable roll and start mode to trigger dice rolling
    }, [resetNotificationFlags, setCurrentWorkoutComplete, setTimerComplete, userId]);

    const handleWorkoutComplete = useWorkoutComplete({
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
      if (userId) clearPendingWorkout(userId);
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
        if (userId) savePendingWorkout(userId, session);
        setLatestSession(session);

        if (isRollAndStartMode) {
          setIsRollAndStartMode(false);
        }
      },
      [isRollAndStartMode, setCurrentWorkoutComplete, userId]
    );

    const handleSplitChange = useCallback(
      async (newSplitId: string) => {
        const newSplit = await saveSplitChange(newSplitId);
        if (newSplit) {
          setSelectedSplit(newSplit);
        }
      },
      [saveSplitChange]
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
              completionError={completionError}
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
            <History history={sessionHistory} />
            {showAchievements && (
              <Suspense
                fallback={
                  <div className="text-center py-4 text-gray-400 text-sm">Loading achievements...</div>
                }>
                <Achievements userProfile={userProfile} />
              </Suspense>
            )}
          </div>

          <div className="col-span-1 space-y-6">
            <SocialFeatures />
            <DashboardStatsPanel
              selectedSplit={selectedSplit}
              multipliers={multipliers}
              stats={stats}
              userProfile={userProfile}
              showAchievements={showAchievements}
              onToggleAchievements={() => setShowAchievements(!showAchievements)}
              onResetDay={() => handleResetClick("game")}
              onExerciseClick={handleExerciseClick}
            />
          </div>
        </div>

        {stableUserProfile && (
          <DashboardModals
            showSettings={showSettings}
            onCloseSettings={() => setShowSettings(false)}
            userProfile={stableUserProfile}
            timerDuration={stableUserProfile.timer_duration}
            updateTimerDuration={updateTimerDuration}
            notificationsEnabled={notificationsEnabled}
            updateNotificationsEnabled={updateNotificationsEnabled}
            onUserProfileUpdate={setUserProfile}
            workoutCompleteModal={workoutCompleteModal}
            showConfirmModal={showConfirmModal.show}
            confirmModalType={showConfirmModal.type}
            onConfirmReset={handleConfirmReset}
            onCancelReset={handleCancelReset}
            unlockedAchievements={unlockedAchievements}
            onDismissAchievement={(id) =>
              setUnlockedAchievements((prev) => prev.filter((achievementId) => achievementId !== id))
            }
            showExerciseModal={showExerciseModal}
            selectedExercise={selectedExercise}
            onCloseExerciseModal={() => setShowExerciseModal(false)}
          />
        )}
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
