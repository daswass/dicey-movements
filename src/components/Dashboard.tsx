import { Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getExerciseById } from "../data/exercises";
import { AppSettings, ExerciseMultipliers, WorkoutSession } from "../types";
import { loadFromLocalStorage, saveToLocalStorage } from "../utils/storage";
import DiceRoller from "./DiceRoller";
import ExerciseDisplay from "./ExerciseDisplay";
import History from "./History";
import SettingsPanel from "./SettingsPanel";
import Timer from "./Timer";

interface DashboardProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ settings, updateSettings }) => {
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

  const [history, setHistory] = useState<WorkoutSession[]>(() => {
    return loadFromLocalStorage("workoutHistory") || [];
  });

  const [timerComplete, setTimerComplete] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [latestSession, setLatestSession] = useState<WorkoutSession | null>(null);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState<boolean>(false);
  const [timerResetKey, setTimerResetKey] = useState<number>(0);

  useEffect(() => {
    saveToLocalStorage("multipliers", multipliers);
  }, [multipliers]);

  useEffect(() => {
    saveToLocalStorage("workoutHistory", history);
  }, [history]);

  const handleTimerComplete = () => {
    setTimerComplete(true);
    setCurrentWorkoutComplete(false);

    if (settings.notificationsEnabled && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    if (settings.notificationsEnabled && Notification.permission === "granted") {
      new Notification("Dicey Movements", {
        body: "Time to roll the dice and exercise!",
        icon: "/vite.svg",
      });
    }
  };

  const handleWorkoutComplete = (session: WorkoutSession) => {
    const newHistory = [session, ...history];
    setHistory(newHistory);

    setLatestSession(session);
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

  const resetAll = () => {
    resetMultipliers();
    resetWorkoutHistory();
    setLatestSession(null);
    setCurrentWorkoutComplete(false);
    setTimerComplete(false);
    setTimerResetKey((prevKey) => prevKey + 1);
  };

  const completeCurrentWorkout = () => {
    setCurrentWorkoutComplete(true);
    setTimerComplete(false);

    if (latestSession) {
      setMultipliers((prev) => ({
        ...prev,
        [latestSession.exercise.id]: (prev[latestSession.exercise.id] || 0) + 1,
      }));
    }
    setLatestSession(null);
  };

  // Calculate total reps for today
  const getTotalRepsToday = () => {
    const today = new Date().setHours(0, 0, 0, 0);
    return history
      .filter((session) => new Date(session.timestamp).setHours(0, 0, 0, 0) === today)
      .reduce((total, session) => total + session.reps, 0);
  };

  const getRepsPerExerciseToday = () => {
    const today = new Date().setHours(0, 0, 0, 0);
    const repsByExercise: { [key: number]: number } = {};

    history
      .filter((session) => new Date(session.timestamp).setHours(0, 0, 0, 0) === today)
      .forEach((session) => {
        repsByExercise[session.exercise.id] =
          (repsByExercise[session.exercise.id] || 0) + session.reps;
      });
    return repsByExercise;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-1 lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Settings size={20} className="text-gray-500 dark:text-gray-400" />
          </button>

          <h2 className="text-xl font-semibold mb-4">Workout Timer</h2>
          <Timer
            key={timerResetKey}
            duration={settings.timerDuration}
            onComplete={handleTimerComplete}
            resetSignal={currentWorkoutComplete}
          />
        </div>

        {timerComplete && !currentWorkoutComplete && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Roll the Dice</h2>
            <DiceRoller
              onRollComplete={handleWorkoutComplete}
              multipliers={multipliers}
              rollCompleted={!!latestSession}
            />
          </div>
        )}

        {latestSession && !currentWorkoutComplete && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Current Workout</h2>
              <button
                onClick={completeCurrentWorkout}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors">
                Complete Exercise
              </button>
            </div>
            <ExerciseDisplay session={latestSession} />
          </div>
        )}
      </div>

      <div className="col-span-1 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-semibold">Stats</h3>
            <div className="flex space-x-2">
              <button
                onClick={resetAll}
                className="px-3 py-1.5 text-sm hover:bg-red-600 text-white rounded-lg transition-colors">
                Reset Game
              </button>
              <button
                onClick={resetMultipliers}
                className="px-3 py-1.5 text-sm hover:bg-red-600 text-white rounded-lg transition-colors">
                Reset Multipliers
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Workout History</h2>
            <button
              onClick={resetWorkoutHistory}
              className="px-3 py-1.5 text-sm hover:bg-red-600 text-white rounded-lg transition-colors">
              Reset History
            </button>
          </div>
          <History history={history} />
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-md w-full">
            <SettingsPanel
              settings={settings}
              updateSettings={updateSettings}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
