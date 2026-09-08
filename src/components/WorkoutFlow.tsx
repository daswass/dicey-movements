import { Settings, Dumbbell } from "lucide-react";
import { ExerciseMultipliers, Split, WorkoutSession } from "../types";
import { UserProfile } from "../types/social";
import { splits } from "../data/exercises";
import DiceRoller from "./DiceRoller";
import ExerciseDisplay from "./ExerciseDisplay";
import Timer from "./Timer";

interface WorkoutFlowProps {
  timerComplete: boolean;
  currentWorkoutComplete: boolean;
  isRollAndStartMode: boolean;
  latestSession: WorkoutSession | null;
  userProfile: UserProfile | null;
  timerDuration: number | undefined;
  multipliers: ExerciseMultipliers;
  selectedSplit: Split;
  isMaster: boolean;
  isCompletingWorkout: boolean;
  completionError: string | null;
  showSplitsPanel: boolean;
  onToggleSettings: () => void;
  onToggleSplitsPanel: () => void;
  onTimerComplete: () => void;
  onRollAndStart: () => void;
  onDiceRoll: (session: WorkoutSession) => void;
  onSplitChange: (splitId: string) => void;
  onWorkoutComplete: () => void;
}

export default function WorkoutFlow({
  timerComplete,
  currentWorkoutComplete,
  isRollAndStartMode,
  latestSession,
  userProfile,
  timerDuration,
  multipliers,
  selectedSplit,
  isMaster,
  isCompletingWorkout,
  completionError,
  showSplitsPanel,
  onToggleSettings,
  onToggleSplitsPanel,
  onTimerComplete,
  onRollAndStart,
  onDiceRoll,
  onSplitChange,
  onWorkoutComplete,
}: WorkoutFlowProps) {
  const masterIndicator = (
    <div
      className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
        isMaster ? "bg-green-500" : "bg-blue-500"
      }`}
      title={isMaster ? "Master Device" : "Slave Device"}
    />
  );

  if (latestSession) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">Current Workout</h2>
          <button
            onClick={onWorkoutComplete}
            disabled={isCompletingWorkout}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              isCompletingWorkout
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600"
            }`}>
            {isCompletingWorkout ? "Completing..." : "Complete Exercise"}
          </button>
        </div>
        {completionError && (
          <p
            role="alert"
            className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {completionError}
          </p>
        )}
        <ExerciseDisplay session={latestSession} onComplete={onWorkoutComplete} />
      </div>
    );
  }

  if ((timerComplete && !currentWorkoutComplete) || isRollAndStartMode) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 relative">
        <button
          onClick={onToggleSettings}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Settings size={20} className="text-gray-500 dark:text-gray-400" />
          {masterIndicator}
        </button>
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Roll the Dice</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Active Split:</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{selectedSplit.name}</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
              {selectedSplit.exercises.length} exercises
            </span>
          </div>
        </div>
        {userProfile?.user_split_id ? (
          <DiceRoller
            key={`dice-roller-${latestSession ? "completed" : "ready"}`}
            onRollComplete={onDiceRoll}
            multipliers={multipliers}
            rollCompleted={!!latestSession}
            session={latestSession}
            autoRoll={isRollAndStartMode}
            selectedSplit={selectedSplit}
          />
        ) : (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading workout split...</p>
          </div>
        )}
      </div>
    );
  }

  if (userProfile) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 relative">
        <div className="absolute top-4 right-4 flex space-x-2">
          <button
            onClick={onToggleSplitsPanel}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Select Workout Split">
            <Dumbbell size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
          <button
            onClick={onToggleSettings}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Settings size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
          {masterIndicator}
        </div>
        <h2 className="text-xl font-semibold mb-4">Workout Timer</h2>
        <Timer
          duration={timerDuration ?? 300}
          onComplete={onTimerComplete}
          onRollAndStart={onRollAndStart}
        />

        {showSplitsPanel && userProfile.user_split_id && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Select Workout Split
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {splits.map((split) => (
                <button
                  key={split.id}
                  onClick={() => onSplitChange(split.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedSplit.id === split.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300"
                  }`}>
                  <div className="text-center">
                    <div className="text-2xl mb-1">{split.emoji}</div>
                    <div className="font-medium text-sm">{split.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {split.exercises.length} exercises
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
