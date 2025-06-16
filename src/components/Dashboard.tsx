import { Session } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { getExerciseById } from "../data/exercises";
import { AppSettings, ExerciseMultipliers, WorkoutSession } from "../types";
import { UserProfile } from "../types/social";
import { getUserLocation, getUserProfile, updateUserProfile } from "../utils/socialService";
import { loadFromLocalStorage, saveToLocalStorage } from "../utils/storage";
import { supabase } from "../utils/supabaseClient";
import DiceRoller from "./DiceRoller";
import ExerciseDisplay from "./ExerciseDisplay";
import History from "./History";
import SettingsPanel from "./SettingsPanel";
import SocialFeatures from "./SocialFeatures";
import Timer from "./Timer";

interface DashboardProps {
  session: Session;
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  timerComplete: boolean;
  setTimerComplete: (complete: boolean) => void;
  currentWorkoutComplete: boolean;
  setCurrentWorkoutComplete: (complete: boolean) => void;
  onStartTimer: () => void;
  timeLeft: number;
  setTimeLeft: (time: number) => void;
  isTimerActive: boolean;
  setIsTimerActive: (active: boolean) => void;
}

// Define Activity type for activities table
interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number;
  dice_roll: any;
}

const Dashboard: React.FC<DashboardProps> = ({
  session,
  settings,
  updateSettings,
  timerComplete,
  setTimerComplete,
  currentWorkoutComplete,
  setCurrentWorkoutComplete,
  onStartTimer,
  timeLeft,
  setTimeLeft,
  isTimerActive,
  setIsTimerActive,
}) => {
  const [multipliers, setMultipliers] = useState<ExerciseMultipliers>(() => {
    return (
      loadFromLocalStorage("multipliers") || {
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1,
        6: 1,
      }
    );
  });

  const [history, setHistory] = useState<Activity[]>([]);

  const [latestSession, setLatestSession] = useState<WorkoutSession | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHighFiveModal, setShowHighFiveModal] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    type: "game" | "multipliers" | null;
  }>({ show: false, type: null });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerWorkerRef = useRef<Worker | null>(null);
  const [currentExercise, setCurrentExercise] = useState<any | null>(null);
  const [lastSessionStart, setLastSessionStart] = useState<Date | null>(null);
  const [timerDuration, setTimerDuration] = useState<number>(60); // default 60 seconds
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  useEffect(() => {
    saveToLocalStorage("multipliers", multipliers);
  }, [multipliers]);

  useEffect(() => {
    saveToLocalStorage("workoutHistory", history);
  }, [history]);

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

  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    const fetchProfile = async () => {
      let profile = await getUserProfile();
      if (!profile) {
        // Create a new profile if it doesn't exist
        const location = await getUserLocation();
        profile = await updateUserProfile({
          username: user.email.split("@")[0],
          location,
        });
      }
      setUserProfile(profile);
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    // Initialize timer worker
    timerWorkerRef.current = new Worker(new URL("../workers/timer.worker.ts", import.meta.url));

    // Handle worker messages
    timerWorkerRef.current.onmessage = (e) => {
      const { type, timeLeft: newTimeLeft } = e.data;

      switch (type) {
        case "TICK":
          setTimeLeft(newTimeLeft);
          break;
        case "COMPLETE":
          setTimeLeft(0);
          setIsTimerRunning(false);
          setTimerComplete(true);
          // Show notification if browser supports it
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Workout Timer", {
              body: "Your rest period is complete!",
              icon: "/dice.png",
            });
          }
          break;
      }
    };

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      timerWorkerRef.current?.terminate();
    };
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false });
    if (!error) {
      setHistory(data);
    } else {
      console.error("Error fetching history:", error);
    }
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, currentWorkoutComplete]);

  const handleTimerComplete = () => {
    setTimerComplete(true);
    setCurrentWorkoutComplete(false);
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification("Workout Timer", {
        body: "Your rest period is complete!",
        icon: "/dice.png",
      });
    }
  };

  const handleWorkoutComplete = async () => {
    if (!latestSession) return;
    console.log("Inserting activity:", latestSession);
    const { error } = await supabase.from("activities").insert({
      user_id: user.id,
      timestamp: new Date().toISOString(),
      exercise_id: latestSession.exercise.id,
      exercise_name: latestSession.exercise.name,
      reps: latestSession.reps,
      multiplier: latestSession.multiplier,
      dice_roll: latestSession.diceRoll,
    });
    if (error) {
      console.error("Error inserting activity:", error);
    } else {
      console.log("Activity inserted successfully");
    }
    // Increment multiplier for the completed exercise
    setMultipliers((prev) => ({
      ...prev,
      [latestSession.exercise.id]: (prev[latestSession.exercise.id] || 1) + 1,
    }));
    setCurrentWorkoutComplete(true);
    setTimerComplete(false);
    onStartTimer();
    setLatestSession(null);
  };

  const resetMultipliers = () => {
    setMultipliers({
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 1,
    });
  };

  const resetWorkoutHistory = () => {
    setHistory([]);
  };

  const fetchLastSessionStart = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("last_session_start")
      .eq("id", user.id)
      .single();
    if (!error && data) {
      setLastSessionStart(data.last_session_start ? new Date(data.last_session_start) : null);
    }
  };

  useEffect(() => {
    if (user) fetchLastSessionStart();
  }, [user]);

  const resetAll = async () => {
    console.log("Resetting all session state");
    setMultipliers({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 });
    setLatestSession(null);
    setCurrentWorkoutComplete(false);
    setTimerComplete(false);
    setTimerResetKey((prevKey) => prevKey + 1);
    // Update last_session_start in DB
    const { error } = await supabase
      .from("profiles")
      .update({ last_session_start: new Date().toISOString() })
      .eq("id", user.id);
    if (!error) {
      await fetchLastSessionStart();
      await fetchHistory();
    }
  };

  const completeCurrentWorkout = async () => {
    setCurrentWorkoutComplete(true);
    setTimerComplete(false);
    setShowHighFiveModal(true);

    setTimeout(() => {
      setShowHighFiveModal(false);
    }, 2000);

    if (latestSession) {
      // Update multipliers
      setMultipliers((prev) => ({
        ...prev,
        [latestSession.exercise.id]: (prev[latestSession.exercise.id] || 0) + 1,
      }));

      // Create activity in friend_activities table
      if (user && userProfile) {
        const { error } = await supabase.from("friend_activities").insert({
          user_id: user.id,
          username: userProfile.username || `${userProfile.first_name} ${userProfile.last_name}`,
          activity_type: "exercise",
          details: `Completed ${latestSession.reps} reps of ${latestSession.exercise.name}`,
          timestamp: new Date().toISOString(),
        });

        if (error) {
          console.error("Error creating activity:", error);
        }
      }

      // Update user's stats
      if (userProfile) {
        const { error } = await supabase
          .from("profiles")
          .update({
            stats: {
              totalReps: (userProfile.stats.totalReps || 0) + latestSession.reps,
              totalSets: (userProfile.stats.totalSets || 0) + 1,
              streak: userProfile.stats.streak || 0,
              achievements: userProfile.stats.achievements || [],
            },
          })
          .eq("id", user.id);

        if (error) {
          console.error("Error updating stats:", error);
        }
      }
    }

    setLatestSession(null);
  };

  const getTotalSetsToday = () => {
    if (!lastSessionStart) return 0;
    return history.filter((session) => new Date(session.timestamp) > lastSessionStart).length;
  };

  const getTotalRepsToday = () => {
    if (!lastSessionStart) return 0;
    return history
      .filter((session) => new Date(session.timestamp) > lastSessionStart)
      .reduce((total, session) => total + session.reps, 0);
  };

  const getRepsPerExerciseToday = () => {
    if (!lastSessionStart) return {};
    const repsByExercise: Record<number, number> = {};
    history
      .filter((session) => new Date(session.timestamp) > lastSessionStart)
      .forEach((session) => {
        repsByExercise[session.exercise_id] =
          (repsByExercise[session.exercise_id] || 0) + session.reps;
      });
    return repsByExercise;
  };

  const handleResetClick = (type: "game" | "multipliers") => {
    setShowConfirmModal({ show: true, type });
  };

  const handleConfirmReset = () => {
    if (showConfirmModal.type === "game") {
      resetAll();
    } else if (showConfirmModal.type === "multipliers") {
      resetMultipliers();
    }
    setShowConfirmModal({ show: false, type: null });
  };

  const handleCancelReset = () => {
    setShowConfirmModal({ show: false, type: null });
  };

  const handleDiceRoll = (session: any) => {
    setCurrentExercise(session.exercise);
    setCurrentWorkoutComplete(false);
    setLatestSession(session);
  };

  // Filter activities for the current session
  const sessionHistory = lastSessionStart
    ? history.filter((session) => new Date(session.timestamp) > lastSessionStart)
    : [];

  // Fetch timer_duration and notifications_enabled from profile
  const fetchProfileSettings = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("timer_duration, notifications_enabled")
      .eq("id", user.id)
      .single();
    if (!error && data) {
      if (data.timer_duration) {
        setTimerDuration(data.timer_duration);
        setTimeLeft(data.timer_duration);
      }
      if (typeof data.notifications_enabled === "boolean")
        setNotificationsEnabled(data.notifications_enabled);
    }
  };

  useEffect(() => {
    if (user) fetchProfileSettings();
  }, [user]);

  const updateNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (user) {
      await supabase.from("profiles").update({ notifications_enabled: enabled }).eq("id", user.id);
    }
  };

  // On settings change, update timer_duration in DB
  const updateTimerDuration = async (newDuration: number) => {
    setTimerDuration(newDuration);
    setTimeLeft(newDuration);
    setIsTimerActive(false);
    if (user) {
      await supabase.from("profiles").update({ timer_duration: newDuration }).eq("id", user.id);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {timerComplete && !currentWorkoutComplete ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Roll the Dice</h2>
              <DiceRoller
                onRollComplete={handleDiceRoll}
                multipliers={multipliers}
                rollCompleted={!!latestSession}
              />
            </div>
          ) : !latestSession ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Settings size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
              <h2 className="text-xl font-semibold mb-4">Workout Timer</h2>
              <Timer
                key={timerResetKey}
                duration={timerDuration}
                onComplete={handleTimerComplete}
                resetSignal={currentWorkoutComplete}
                isActive={isTimerActive}
                setIsActive={setIsTimerActive}
                timeLeft={timeLeft}
                setTimeLeft={setTimeLeft}
              />
            </div>
          ) : null}

          {latestSession && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Current Workout</h2>
                <button
                  onClick={() => {
                    console.log("Button clicked");
                    handleWorkoutComplete();
                  }}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                  Complete Exercise
                </button>
              </div>
              <ExerciseDisplay session={latestSession} onComplete={handleWorkoutComplete} />
            </div>
          )}

          <History history={sessionHistory as any[]} />
        </div>

        <div className="col-span-1 space-y-6">
          {userProfile && <SocialFeatures userProfile={userProfile} />}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">Stats</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleResetClick("game")}
                  className="px-3 py-1.5 text-sm hover:bg-red-600 text-white rounded-lg transition-colors">
                  Reset Game
                </button>
                <button
                  onClick={() => handleResetClick("multipliers")}
                  className="px-3 py-1.5 text-sm hover:bg-red-600 text-white rounded-lg transition-colors">
                  Reset Multipliers
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-md font-medium">Total Sets Today:</h4>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {getTotalSetsToday()}
              </span>
              <h4 className="text-md font-medium">Total Reps Today:</h4>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {getTotalRepsToday()}
              </span>
            </div>

            <h4 className="text-md font-medium mb-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              Exercises:
            </h4>
            <div className="space-y-2">
              {Object.entries(multipliers).map(([exerciseId, multiplier]) => {
                const exercise = getExerciseById(Number(exerciseId));
                const repsToday = getRepsPerExerciseToday()[Number(exerciseId)] || 0;
                return (
                  <div
                    key={exerciseId}
                    className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="truncate" title={exercise.name}>
                      {exercise.name}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      Reps: {repsToday}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {multiplier}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Settings</h2>
            <SettingsPanel
              timerDuration={timerDuration}
              updateTimerDuration={updateTimerDuration}
              notificationsEnabled={notificationsEnabled}
              updateNotificationsEnabled={updateNotificationsEnabled}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}

      {showHighFiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center">
            <h2 className="text-4xl mb-4">🙌</h2>
            <p className="text-xl">Great job!</p>
          </div>
        </div>
      )}

      {showConfirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-semibold mb-4">
              {showConfirmModal.type === "game" ? "Reset Game?" : "Reset Multipliers?"}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {showConfirmModal.type === "game"
                ? "This will reset all game progress, including multipliers and history."
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
};

export default Dashboard;
