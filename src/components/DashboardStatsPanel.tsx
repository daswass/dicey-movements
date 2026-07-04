import { getExerciseById } from "../data/exercises";
import { ExerciseMultipliers, Exercise, Split } from "../types";
import { UserProfile } from "../types/social";

interface DashboardStatsPanelProps {
  selectedSplit: Split;
  multipliers: ExerciseMultipliers;
  stats: {
    totalSetsToday: number;
    totalRepsToday: number;
    repsPerExerciseToday: Record<number, number>;
  };
  userProfile: UserProfile | null;
  showAchievements: boolean;
  onToggleAchievements: () => void;
  onResetDay: () => void;
  onExerciseClick: (exercise: Exercise) => void;
}

export default function DashboardStatsPanel({
  selectedSplit,
  multipliers,
  stats,
  userProfile,
  showAchievements,
  onToggleAchievements,
  onResetDay,
  onExerciseClick,
}: DashboardStatsPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center space-x-3">
          <h3 className="text-xl font-semibold">Stats</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <span>•</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{selectedSplit.name}</span>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onToggleAchievements}
            className="px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors">
            {showAchievements ? "Hide" : ""} Achievements
          </button>
          <button
            onClick={onResetDay}
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
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Streak:</h4>
          </div>
          <div className="flex items-center space-x-2">
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Current</h4>
            <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
              {userProfile?.stats?.streak || 0} days
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <h4 className="text-md font-medium text-gray-700 dark:text-gray-300">Longest</h4>
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
              <button
                onClick={() => onExerciseClick(exercise)}
                className="truncate text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left flex-1"
                title={`Click to see instructions for ${exercise.name}`}>
                {exercise.name}
              </button>
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
  );
}
