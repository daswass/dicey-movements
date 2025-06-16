import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

interface Profile {
  id: string;
  username: string;
  stats: {
    totalReps: number;
    totalSets: number;
    streak: number;
    achievements: string[];
  };
  location: {
    city: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  updated_at: string;
}

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  score: number;
  location: string;
  timestamp: string;
}

type ScoreType = "totalReps" | "totalSets";

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreType, setScoreType] = useState<ScoreType>("totalReps");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("week");

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("profiles")
        .select("id, username, stats, location, updated_at")
        .order(`stats->${scoreType}`, { ascending: false });

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
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        query = query.gte("updated_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedEntries = data.map((profile: Profile) => ({
        id: profile.id,
        user_id: profile.id,
        username: profile.username,
        score: profile.stats[scoreType] || 0,
        location: profile.location.city,
        timestamp: profile.updated_at,
      }));

      setEntries(formattedEntries);
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [scoreType, timeRange]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Leaderboard</h2>
        <div className="flex space-x-4">
          <select
            value={scoreType}
            onChange={(e) => setScoreType(e.target.value as ScoreType)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
            <option value="totalReps">Total Reps</option>
            <option value="totalSets">Total Sets</option>
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as "day" | "week" | "month" | "all")}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white">
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-500 text-white rounded-full">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{entry.username}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{entry.location}</div>
                </div>
              </div>
              <div className="text-lg font-semibold">
                {entry.score.toLocaleString()} {scoreType === "totalReps" ? "reps" : "sets"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
