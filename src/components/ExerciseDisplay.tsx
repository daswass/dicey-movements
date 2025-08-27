import { CheckCircle, Clock } from "lucide-react";
import React from "react";
import { WorkoutSession } from "../types";
import { getExerciseEmoji } from "../data/exercises";

interface ExerciseDisplayProps {
  session: WorkoutSession;
  onComplete: () => Promise<void>;
}

const ExerciseDisplay: React.FC<ExerciseDisplayProps> = ({ session }) => {
  const { exercise, reps, multiplier, diceRoll, timestamp } = session;
  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col md:flex-row items-center">
      <div className="text-center md:text-left flex-1">
        <div className="flex items-center justify-center mb-6">
          <span className="text-5xl mr-2">{getExerciseEmoji(exercise.name)}</span>
          <h2 className="text-3xl font-bold">{exercise.name}</h2>
        </div>

        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-center md:justify-start text-gray-700 dark:text-gray-300">
            <CheckCircle size={16} className="mr-2 text-green-500" />
            <span>
              <strong>{reps} reps</strong>
              {multiplier > 1 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {" "}
                  ({diceRoll.repsDie} × {multiplier})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center justify-center md:justify-start text-gray-700 dark:text-gray-300">
            <Clock size={16} className="mr-2 text-blue-500" />
            <span>{formattedTime}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 md:mt-0">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl animate-pulse" />
          <div className="relative bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-xl p-6 shadow-lg">
            <div className="text-center">
              <h4 className="text-lg text-gray-500 dark:text-gray-400">Complete This:</h4>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {reps} {exercise.name}s
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseDisplay;
