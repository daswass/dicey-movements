import React from "react";
import { getExerciseById } from "../data/exercises";

interface Activity {
  id: string;
  user_id: string;
  timestamp: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number;
  dice_roll?: { repsDie?: number };
}

interface HistoryProps {
  history: Activity[];
}

const History: React.FC<HistoryProps> = ({ history }) => {
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
    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
      {Object.entries(groupedSessions).map(([date, sessions]) => (
        <div key={date} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 sticky top-0 bg-white dark:bg-gray-800 py-1">
            {date === new Date().toLocaleDateString() ? "Today" : date}
          </h3>

          {sessions.map((session) => {
            const exercise = getExerciseById(session.exercise_id);
            return (
              <div
                key={session.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">{exercise.emoji}</span>
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

                  <div className="text-right">
                    <span className="font-bold">{session.reps} reps</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {session.dice_roll?.repsDie ?? "-"} × {session.multiplier}
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
