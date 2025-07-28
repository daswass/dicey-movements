import { Settings } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getExerciseById } from "../data/exercises";
import { ExerciseMultipliers, WorkoutSession } from "../types";
import { UserProfile } from "../types/social";
import { AchievementService } from "../utils/achievementService";
import { supabase } from "../utils/supabaseClient"; // Removed load/save from local storage
import { sendFriendActivityNotification } from "../utils/socialService";
import { AchievementNotification } from "./AchievementNotification";
import { Achievements } from "./Achievements";
import DiceRoller from "./DiceRoller";
import ExerciseDisplay from "./ExerciseDisplay";
import History from "./History";
import SettingsPanel from "./SettingsPanel";
import SocialFeatures from "./SocialFeatures";
import Timer from "./Timer";

interface DashboardProps {
  timerComplete: boolean;
  setTimerComplete: (complete: boolean) => void;
  currentWorkoutComplete: boolean;
  setCurrentWorkoutComplete: (complete: boolean) => void;
  onStartTimer: () => void;
  onResetTimerToDuration: (newDuration: number) => void;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number; // This multiplier is the multiplier *at the time of the activity*
  dice_roll: any;
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
  }) => {
    const [exerciseCounts, setExerciseCounts] = useState<Record<number, number>>({});

    // DERIVED STATE: Multipliers based on exerciseCounts (since last_session_start)
    const multipliers: ExerciseMultipliers = useMemo(() => {
      const calculatedMultipliers: ExerciseMultipliers = {};
      for (let i = 1; i <= 6; i++) {
        calculatedMultipliers[i] = (exerciseCounts[i] || 0) + 1; // Multiplier is 1 + count
      }
      return calculatedMultipliers;
    }, [exerciseCounts]);

    const [history, setHistory] = useState<Activity[]>([]);
    const [latestSession, setLatestSession] = useState<WorkoutSession | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showHighFiveModal, setShowHighFiveModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState<{
      show: boolean;
      type: "game" | "multipliers" | null;
    }>({ show: false, type: null });
    const [user, setUser] = useState<any>(null);
    const [lastSessionStart, setLastSessionStart] = useState<Date | null>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

    // Achievement state
    const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
    const [showAchievements, setShowAchievements] = useState(false);

    // Add new state for Roll & Start mode
    const [isRollAndStartMode, setIsRollAndStartMode] = useState(false);

    // Memoize userProfile to prevent unnecessary re-renders
    const stableUserProfile = useMemo(
      () => userProfile,
      [userProfile?.id, userProfile?.timer_duration, userProfile?.notifications_enabled]
    );

    useEffect(() => {
      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event: string, session: { user: any } | null) => {
          setUser(session?.user ?? null);
        }
      );
      supabase.auth.getUser().then(({ data }: { data: { user: any } }) => setUser(data.user));
      return () => {
        listener.subscription.unsubscribe();
      };
    }, []);

    const fetchHistory = useCallback(async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Dashboard: Error fetching history:", error);
        return;
      }

      const currentExerciseCounts: Record<number, number> = {};
      const currentLastSessionStart = lastSessionStart;

      (data || []).forEach((activity) => {
        // Only count activity if it happened AFTER the last session start
        if (!currentLastSessionStart || new Date(activity.timestamp) > currentLastSessionStart) {
          currentExerciseCounts[activity.exercise_id] =
            (currentExerciseCounts[activity.exercise_id] || 0) + 1;
        }
      });

      setHistory(data || []);
      setExerciseCounts(currentExerciseCounts);
    }, [user?.id, lastSessionStart]);

    useEffect(() => {
      if (user) fetchHistory();
    }, [user?.id, fetchHistory]);

    const handleTimerComplete = useCallback(() => {
      setTimerComplete(true);
      setCurrentWorkoutComplete(false);
    }, [setTimerComplete, setCurrentWorkoutComplete]);

    const handleRollAndStart = useCallback(() => {
      setIsRollAndStartMode(true);
      // Don't set timerComplete to true to avoid triggering the sound
      // Instead, we'll show the dice roller directly
      setCurrentWorkoutComplete(false);
    }, []);

    const handleWorkoutComplete = useCallback(async () => {
      setShowHighFiveModal(true);

      setTimeout(() => {
        setShowHighFiveModal(false);
      }, 2000);

      if (!latestSession || !user) return;

      // Get the current (derived) multiplier for this exercise before logging it in activity
      const currentMultiplier = multipliers[latestSession.exercise.id] || 1;

      const newActivity = {
        id: crypto.randomUUID(),
        user_id: user.id,
        timestamp: new Date().toISOString(),
        exercise_id: latestSession.exercise.id,
        exercise_name: latestSession.exercise.name,
        reps: latestSession.reps,
        multiplier: currentMultiplier, // Store the multiplier *at the time of this activity*
        dice_roll: latestSession.diceRoll,
      };

      const { error } = await supabase.from("activities").insert(newActivity);
      if (error) {
        console.error("Dashboard: Error inserting activity:", error);
        setHistory((prevHistory) => prevHistory.slice(1)); // Revert locally if insert fails
      } else {
        await fetchHistory(); // Trigger re-fetch of history to update calculated counts/multipliers

        // Refresh user profile to get updated streak data
        try {
          const { data: updatedProfile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

          if (updatedProfile && !profileError) {
            setUserProfile({
              ...updatedProfile,
              timer_duration: updatedProfile.timer_duration || 300,
            });
          } else {
            console.error("Dashboard: Error refreshing user profile:", profileError);
          }
        } catch (profileError) {
          console.error("Dashboard: Exception refreshing user profile:", profileError);
        }

        // Check for achievements after successful activity insertion
        try {
          // Check single workout achievements
          const singleWorkoutAchievements = await AchievementService.checkSingleWorkoutAchievements(
            user.id,
            latestSession.reps
          );

          // Check general achievements
          const generalAchievements = await AchievementService.checkAndUnlockAchievements(user.id);

          // Combine and show notifications
          const allNewAchievements = [...singleWorkoutAchievements, ...generalAchievements];
          if (allNewAchievements.length > 0) {
            setUnlockedAchievements(allNewAchievements);
          }
        } catch (error) {
          console.error("Error checking achievements:", error);
        }

        // Send friend activity notification
        try {
          const activity = `${latestSession.exercise.name} (${latestSession.reps} reps)`;
          await sendFriendActivityNotification(user.id, activity);
        } catch (error) {
          console.error("Error sending friend activity notification:", error);
        }
      }

      setCurrentWorkoutComplete(true);
      setTimerComplete(false);
      onStartTimer();
      setLatestSession(null);
      setIsRollAndStartMode(false); // Reset roll and start mode
    }, [latestSession, user?.id, multipliers, fetchHistory, setUserProfile]);

    const fetchLastSessionStart = useCallback(async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("last_session_start")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setLastSessionStart(data.last_session_start ? new Date(data.last_session_start) : null);
      }
    }, [user?.id]);

    useEffect(() => {
      if (user) fetchLastSessionStart();
    }, [user?.id, fetchLastSessionStart]);

    const resetAll = useCallback(async () => {
      console.log("Dashboard: Resetting all game state.");

      setLatestSession(null);
      setCurrentWorkoutComplete(false);
      setTimerComplete(false);
      setIsRollAndStartMode(false); // Reset roll and start mode

      const { error } = await supabase
        .from("profiles")
        .update({ last_session_start: new Date().toISOString() })
        .eq("id", user.id);
      if (!error) {
        await fetchLastSessionStart();
        await fetchHistory();
      } else {
        console.error("Dashboard: Error updating last_session_start:", error);
      }
    }, [
      user?.id,
      fetchLastSessionStart,
      fetchHistory,
      setLatestSession,
      setCurrentWorkoutComplete,
      setTimerComplete,
    ]);

    // useEffect for auto-reset on date change using setInterval
    useEffect(() => {
      const checkAndReset = () => {
        if (user && lastSessionStart) {
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
    }, [user?.id, lastSessionStart, resetAll]);

    // Helper functions for Stats Panel (use history & lastSessionStart from DB)
    const getTotalSetsToday = useCallback(() => {
      if (!lastSessionStart) return 0;
      return history.filter((activity) => new Date(activity.timestamp) > lastSessionStart).length;
    }, [lastSessionStart, history]);

    const getTotalRepsToday = useCallback(() => {
      if (!lastSessionStart) return 0;
      return history
        .filter((activity) => new Date(activity.timestamp) > lastSessionStart)
        .reduce((total, activity) => total + activity.reps, 0);
    }, [lastSessionStart, history]);

    const getRepsPerExerciseToday = useCallback(() => {
      if (!lastSessionStart) return {};
      const repsByExercise: Record<number, number> = {};
      history
        .filter((activity) => new Date(activity.timestamp) > lastSessionStart)
        .forEach((activity) => {
          repsByExercise[activity.exercise_id] =
            (repsByExercise[activity.exercise_id] || 0) + activity.reps;
        });
      return repsByExercise;
    }, [lastSessionStart, history]);

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
      (session: any) => {
        setCurrentWorkoutComplete(false);
        setLatestSession(session);

        // If we're in roll and start mode, start the timer after the roll
        if (isRollAndStartMode) {
          setIsRollAndStartMode(false);
          onStartTimer();
        }
      },
      [isRollAndStartMode, onStartTimer]
    );

    // Memoize the sessionHistory to prevent unnecessary recalculations
    const sessionHistory = useMemo(() => {
      return lastSessionStart
        ? history.filter((activity) => new Date(activity.timestamp) > lastSessionStart)
        : [];
    }, [lastSessionStart, history]);

    // Memoize the stats calculations to prevent unnecessary re-renders
    const statsData = useMemo(() => {
      const totalSetsToday = getTotalSetsToday();
      const totalRepsToday = getTotalRepsToday();
      const repsPerExerciseToday = getRepsPerExerciseToday();

      return {
        totalSetsToday,
        totalRepsToday,
        repsPerExerciseToday,
      };
    }, [getTotalSetsToday, getTotalRepsToday, getRepsPerExerciseToday]);

    const updateNotificationsEnabled = useCallback(
      async (enabled: boolean) => {
        setNotificationsEnabled(enabled);
        if (user) {
          const { error } = await supabase
            .from("profiles")
            .update({ notifications_enabled: enabled })
            .eq("id", user.id);
          if (error) {
            console.error("Dashboard: Error updating notifications_enabled:", error);
          } else {
            setUserProfile((prev) => (prev ? { ...prev, notifications_enabled: enabled } : null));
          }
        }
      },
      [user?.id, setUserProfile]
    );

    const updateTimerDuration = useCallback(
      async (newDuration: number) => {
        console.log("Dashboard: updateTimerDuration received newDuration:", newDuration);
        onResetTimerToDuration(newDuration); // Call context to set timeLeft and stop worker

        if (user) {
          const { error } = await supabase
            .from("profiles")
            .update({ timer_duration: newDuration })
            .eq("id", user.id);
          if (error) {
            console.error("Dashboard: Error updating timer_duration in DB:", error);
          } else {
            const { data: updatedProfileFromDb, error: fetchError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single();
            if (updatedProfileFromDb && !fetchError) {
              const confirmedProfile = {
                ...updatedProfileFromDb,
                timer_duration: updatedProfileFromDb.timer_duration || 300,
              };
              setUserProfile(confirmedProfile);
              console.log(
                "Dashboard: setUserProfile in App.tsx called with confirmed DB data:",
                JSON.stringify(confirmedProfile)
              );
            } else {
              console.error("Dashboard: Error re-fetching profile after update:", fetchError);
              setUserProfile((prev) => (prev ? { ...prev, timer_duration: newDuration } : null));
            }
          }
        }
      },
      [user?.id, onResetTimerToDuration, setUserProfile]
    );

    // Memoize the main content to prevent unnecessary re-renders
    const mainContent = useMemo(() => {
      if ((timerComplete && !currentWorkoutComplete) || isRollAndStartMode) {
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Roll the Dice</h2>
            <DiceRoller
              key={`dice-roller-${latestSession ? "completed" : "ready"}`}
              onRollComplete={handleDiceRoll}
              multipliers={multipliers}
              rollCompleted={!!latestSession}
              session={latestSession}
              autoRoll={isRollAndStartMode}
            />
          </div>
        );
      } else if (!latestSession && stableUserProfile) {
        return (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <Settings size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
            <h2 className="text-xl font-semibold mb-4">Workout Timer</h2>
            <Timer
              duration={stableUserProfile?.timer_duration}
              onComplete={handleTimerComplete}
              onRollAndStart={handleRollAndStart}
            />
          </div>
        );
      }
      return null;
    }, [
      timerComplete,
      currentWorkoutComplete,
      isRollAndStartMode,
      latestSession,
      stableUserProfile,
      multipliers,
      handleDiceRoll,
      handleTimerComplete,
      handleRollAndStart,
      showSettings,
    ]);

    const currentWorkoutContent = useMemo(() => {
      if (!latestSession) return null;

      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Current Workout</h2>
            <button
              onClick={handleWorkoutComplete}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
              Complete Exercise
            </button>
          </div>
          <ExerciseDisplay session={latestSession} onComplete={handleWorkoutComplete} />
        </div>
      );
    }, [latestSession, handleWorkoutComplete]);

    // Early return after all hooks
    if (!user) {
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 space-y-6">
            {mainContent}
            {currentWorkoutContent}
            <History history={sessionHistory as any[]} />
            {showAchievements && <Achievements userProfile={userProfile} />}
          </div>

          <div className="col-span-1 space-y-6">
            {(() => {
              return null;
            })()}
            {stableUserProfile && <SocialFeatures userProfile={stableUserProfile} />}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-semibold">Stats</h3>
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
                      {statsData.totalSetsToday}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Reps</h4>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                      {statsData.totalRepsToday}
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
                  const exercise = getExerciseById(Number(exerciseId));
                  const repsToday = statsData.repsPerExerciseToday[Number(exerciseId)] || 0;
                  return (
                    <div
                      key={exerciseId}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                      {/* Exercise Name (stays on the left) */}
                      <span
                        className="truncate text-gray-800 dark:text-gray-200"
                        title={exercise.name}>
                        {exercise.name}
                      </span>

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

        {showHighFiveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center">
              <h2 className="text-4xl mb-4">🙌</h2>
              <p className="text-xl">That's like you!</p>
            </div>
          </div>
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
