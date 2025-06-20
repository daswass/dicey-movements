import { AnimatePresence, motion } from "framer-motion"; // Correct, modern import
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// --- Helper function to get a CSS class for the flash animation ---
const getFlashClass = (change?: "increase" | "decrease") => {
  if (change === "increase") return "flash-green";
  if (change === "decrease") return "flash-red";
  return "";
};

interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  score: number;
  location: string;
  timestamp: string;
  scoreChange?: "increase" | "decrease";
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

type ScoreType = "totalReps" | "totalSets" | "totalSteps";

export const Leaderboard: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoreType, setScoreType] = useState<ScoreType>("totalReps");
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("week");
  const previousEntriesRef = useRef<Map<string, number>>(new Map());

  const fetchLeaderboard = useCallback(async () => {
    try {
      if (scoreType === "totalSteps") {
        // Fetch Oura steps data
        await fetchOuraStepsLeaderboard();
      } else {
        // Fetch regular activity data
        await fetchActivityLeaderboard();
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      setError("Failed to load leaderboard");
    }
  }, [scoreType, timeRange]);

  const fetchActivityLeaderboard = async () => {
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
      query = query.gte("timestamp", startDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const userScores = new Map<
      string,
      { totalReps: number; totalSets: number; location: string; username: string }
    >();

    (data as unknown as Activity[]).forEach((activity) => {
      const userId = activity.user_id;
      const currentScores = userScores.get(userId) || {
        totalReps: 0,
        totalSets: 0,
        location: activity.profiles?.location?.city || "Unknown",
        username: activity.profiles?.username || "Unknown User",
      };
      currentScores.totalReps += activity.reps;
      currentScores.totalSets += 1;
      userScores.set(userId, currentScores);
    });

    const previousScores = new Map(previousEntriesRef.current);

    const newEntries: LeaderboardEntry[] = Array.from(userScores.entries())
      .map(([userId, scores]) => {
        const currentScore = scoreType === "totalReps" ? scores.totalReps : scores.totalSets;
        const previousScore = previousScores.get(userId);
        let scoreChange: "increase" | "decrease" | undefined;

        if (previousScore !== undefined && currentScore !== previousScore) {
          scoreChange = currentScore > previousScore ? "increase" : "decrease";
        }

        previousEntriesRef.current.set(userId, currentScore);

        return {
          id: userId,
          user_id: userId,
          username: scores.username,
          score: currentScore,
          location: scores.location,
          timestamp: new Date().toISOString(),
          scoreChange: scoreChange,
        };
      })
      .sort((a, b) => b.score - a.score);

    setEntries(newEntries);
  };

  const fetchOuraStepsLeaderboard = async () => {
    // Get all users from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, location");

    if (profilesError) throw profilesError;

    if (!profiles || profiles.length === 0) {
      setEntries([]);
      return;
    }

    let query = supabase.from("oura_activities").select("user_id, steps");

    if (timeRange === "day") {
      // For the "24h" view, we only want today's steps.
      // The background job keeps this data fresh.
      const todayStr = new Date().toISOString().split("T")[0];
      query = query.eq("date", todayStr);
    } else {
      // For other views, calculate the date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case "week":
          startDate.setDate(now.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(now.getMonth() - 1);
          break;
        case "all":
          startDate = new Date(0); // Beginning of time
          break;
      }
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = now.toISOString().split("T")[0];
      query = query.gte("date", startDateStr).lte("date", endDateStr);
    }

    const { data: ouraActivities, error: activitiesError } = await query;

    if (activitiesError) throw activitiesError;

    // Calculate total steps per user
    const userSteps = new Map<string, number>();
    ouraActivities?.forEach((activity) => {
      const currentSteps = userSteps.get(activity.user_id) || 0;
      userSteps.set(activity.user_id, currentSteps + activity.steps);
    });

    // Create entries for all users, with 0 steps for those without Oura data
    const previousScores = new Map(previousEntriesRef.current);
    const newEntries: LeaderboardEntry[] = profiles
      .map((profile) => {
        const steps = userSteps.get(profile.id) || 0;
        const previousScore = previousScores.get(profile.id);
        let scoreChange: "increase" | "decrease" | undefined;

        if (previousScore !== undefined && steps !== previousScore) {
          scoreChange = steps > previousScore ? "increase" : "decrease";
        }

        previousEntriesRef.current.set(profile.id, steps);

        return {
          id: profile.id,
          user_id: profile.id,
          username: profile.username,
          score: steps,
          location: profile.location?.city || "Unknown",
          timestamp: new Date().toISOString(),
          scoreChange: scoreChange,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    setEntries(newEntries);
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const fetchLeaderboardRef = useRef(fetchLeaderboard);
  useEffect(() => {
    fetchLeaderboardRef.current = fetchLeaderboard;
  }, [fetchLeaderboard]);

  useEffect(() => {
    const channel = supabase
      .channel("leaderboard_activities_channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, (_) => {
        if (scoreType !== "totalSteps") {
          fetchLeaderboardRef.current();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "oura_activities" }, (_) => {
        if (scoreType === "totalSteps") {
          fetchLeaderboardRef.current();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [scoreType]);

  const getScoreLabel = (type: ScoreType) => {
    switch (type) {
      case "totalReps":
        return "Reps";
      case "totalSets":
        return "Sets";
      case "totalSteps":
        return "Steps";
      default:
        return "Reps";
    }
  };

  const getScoreUnit = (type: ScoreType) => {
    switch (type) {
      case "totalReps":
        return "reps";
      case "totalSets":
        return "sets";
      case "totalSteps":
        return "steps";
      default:
        return "reps";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div>
        <h2 className="text-2xl font-bold mb-6">Leaderboard</h2>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto sm:flex-nowrap justify-between items-center mb-8">
          <div className="flex rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-sm">
            <div className="grid grid-cols-3">
              {["totalReps", "totalSets", "totalSteps"].map((type) => (
                <button
                  key={type}
                  onClick={() => setScoreType(type as ScoreType)}
                  className={`px-3 py-2 text-sm font-semibold focus:outline-none transition-colors duration-150
                    ${
                      scoreType === type
                        ? "bg-blue-500 text-white"
                        : "bg-transparent text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                    }`}>
                  {getScoreLabel(type as ScoreType)}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-sm">
            <div className="grid grid-cols-4">
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

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {entries.length === 0 && !error ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No leaderboard entries to show.
            </p>
          ) : (
            <AnimatePresence>
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${getFlashClass(
                    entry.scoreChange
                  )}`}>
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
                      <div className="font-medium text-gray-900 dark:text-white">
                        {entry.username}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {entry.location}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {entry.score.toLocaleString()} {getScoreUnit(scoreType)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};
