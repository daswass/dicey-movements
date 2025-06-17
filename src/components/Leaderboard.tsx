import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  score: number;
  location: string;
  timestamp: string;
}

interface Activity {
  user_id: string;
  reps: number;
  multiplier: number;
  timestamp: string;
  profiles: {
    username: string;
    location: {
      city: string;
    };
  } | null;
}

type ScoreType = "totalReps" | "totalSets";

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoreType, setScoreType] = useState<ScoreType>("totalReps");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("week");

  const fetchLeaderboard = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("activities")
        .select(
          `
          user_id,
          reps,
          multiplier,
          timestamp,
          profiles!activities_user_id_fkey (
            username,
            location
          )
        `
        )
        .order("timestamp", { ascending: false });

      // Apply time range filter if needed
      if (timeRange !== "all") {
        const now = new Date();
        let startDate = new Date();
        switch (timeRange) {
          case "day":
            startDate.setDate(now.getDate() - 1);
            break;
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month": // Corrected from month to month - 1
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        query = query.gte("timestamp", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calculate scores for each user
      const userScores = new Map<
        string,
        { totalReps: number; totalSets: number; location: string }
      >();

      (data as unknown as Activity[]).forEach((activity) => {
        const userId = activity.user_id;
        const currentScores = userScores.get(userId) || {
          totalReps: 0,
          totalSets: 0,
          location: activity.profiles?.location?.city || "Unknown",
        };

        currentScores.totalReps += activity.reps;
        currentScores.totalSets += 1;

        userScores.set(userId, currentScores);
      });

      // Convert to array and sort
      const formattedEntries = Array.from(userScores.entries())
        .map(([userId, scores]) => ({
          id: userId,
          user_id: userId,
          username:
            (data as unknown as Activity[]).find((a) => a.user_id === userId)?.profiles?.username ||
            "Unknown User",
          score: scoreType === "totalReps" ? scores.totalReps : scores.totalSets,
          location: scores.location,
          timestamp: new Date().toISOString(), // This timestamp is for the entry creation, not activity
        }))
        .sort((a, b) => b.score - a.score);

      setEntries(formattedEntries);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard");
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [scoreType, timeRange]);

  // every 10 seconds, fetch the leaderboard
  /*
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLeaderboard();
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  */

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {" "}
      <div className="mb-6">
        {" "}
        <h2 className="text-2xl font-bold mb-2">Leaderboard</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto sm:flex-nowrap justify-between items-center">
          {" "}
          <div className="flex rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-sm">
            {" "}
            <div className="grid grid-cols-2">
              {" "}
              {["totalReps", "totalSets"].map((type) => (
                <button
                  key={type}
                  onClick={() => setScoreType(type as ScoreType)}
                  className={`px-3 py-2 text-sm font-semibold focus:outline-none transition-colors duration-150
                    ${
                      scoreType === type
                        ? "bg-blue-500 text-white"
                        : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600" // Added hover
                    }`}>
                  {type === "totalReps" ? "Total Reps" : "Total Sets"}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-sm">
            {" "}
            <div className="grid grid-cols-4">
              {" "}
              {[
                { label: "24h", value: "day" },
                { label: "Week", value: "week" },
                { label: "Month", value: "month" },
                { label: "All", value: "all" },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value as any)}
                  className={`px-2 py-1 text-xs font-semibold focus:outline-none transition-colors duration-150
                    ${
                      timeRange === range.value
                        ? "bg-blue-500 text-white"
                        : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}>
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {/* Leaderboard entries rendering */}
      <div className="space-y-4">
        {entries.length === 0 && !error ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No leaderboard entries to show.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-8 h-8 flex items-center justify-center text-white rounded-full font-bold text-sm ${
                    index === 0
                      ? "bg-yellow-500"
                      : index === 1
                      ? "bg-gray-400"
                      : index === 2
                      ? "bg-amber-600"
                      : "bg-blue-500"
                  }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{entry.username}</div>{" "}
                  <div className="text-sm text-gray-500 dark:text-gray-400">{entry.location}</div>
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {" "}
                {entry.score.toLocaleString()} {scoreType === "totalReps" ? "reps" : "sets"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
