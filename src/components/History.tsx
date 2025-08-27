import React from "react";
import { getExerciseById, getExerciseEmoji } from "../data/exercises";
import { Split } from "../types";
import Dice from "./Dice";

interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number;
  dice_roll?: {
    exerciseDie?: number;
    repsDie?: number;
  };
}

interface HistoryProps {
  history: Activity[];
  selectedSplit: Split;
}

const History: React.FC<HistoryProps> = ({ history, selectedSplit }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-500 dark:text-gray-400">
          No workout history yet. Complete your first workout to see it here!
        </p>
      </div>
    );
  }

  // Group sessions by date
  const groupedSessions: Record<string, Activity[]> = {};

  history.forEach((session) => {
    const date = new Date(session.timestamp).toLocaleDateString();
    if (!groupedSessions[date]) {
      groupedSessions[date] = [];
    }
    groupedSessions[date].push(session);
  });

  return (
    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {Object.entries(groupedSessions).map(([date, sessions]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 sticky top-0 bg-white dark:bg-gray-800 py-1">
            {date === new Date().toLocaleDateString() ? "Today" : date}
          </h3>

          {sessions.map((session) => {
            // Use the currently selected split to display exercise names
            const exercise = getExerciseById(session.exercise_id, selectedSplit.id);
            return (
              <div
                key={session.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4">
                  {/* Column 1: Exercise Info */}
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">{getExerciseEmoji(exercise.name)}</span>
                    <div>
                      <h4 className="font-medium">{exercise.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(session.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  {/* 2. Column 2: Renders TWO dice side-by-side */}
                  <div className="flex justify-center items-center gap-x-3">
                    <Dice
                      value={session.dice_roll?.exerciseDie}
                      className="w-10 h-10 text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
                    />
                    <Dice
                      value={session.dice_roll?.repsDie}
                      className="w-10 h-10 text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-800"
                    />
                  </div>

                  {/* Column 3: Reps and Multiplier Info */}
                  <div className="text-right">
                    <span className="font-bold">{session.reps} reps</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {session.dice_roll?.repsDie ?? "-"} &times; {session.multiplier}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default History;
