import { AnimatePresence, motion } from "framer-motion"; // Correct, modern import
import React, { useCallback, useEffect, useRef, useState } from "react";
import { activitySyncService } from "../utils/activitySyncService";
import {
  type LeaderboardEntry,
  type LeaderboardRpcRow,
  mapLeaderboardRows,
} from "../utils/leaderboard";
import { supabase } from "../utils/supabaseClient";
import { SUPABASE_CHANNEL_STATUS, UI_STATUS } from "../utils/supabaseChannel";

// --- Helper function to get a CSS class for the flash animation ---
const getFlashClass = (change?: "increase" | "decrease") => {
  if (change === "increase") return "flash-green";
  if (change === "decrease") return "flash-red";
  return "";
};

// --- Helper functions for localStorage ---
const getStoredScoreType = (): ScoreType => {
  try {
    const stored = localStorage.getItem("leaderboard_score_type");
    if (stored && ["totalReps", "totalSets", "totalSteps"].includes(stored)) {
      return stored as ScoreType;
    }
  } catch (error) {
    console.warn("Failed to read score type from localStorage:", error);
  }
  return "totalReps";
};

const getStoredTimeRange = (): "day" | "week" | "month" | "all" => {
  try {
    const stored = localStorage.getItem("leaderboard_time_range");
    if (stored && ["day", "week", "month", "all"].includes(stored)) {
      return stored as "day" | "week" | "month" | "all";
    }
  } catch (error) {
    console.warn("Failed to read time range from localStorage:", error);
  }
  return "day";
};

const setStoredScoreType = (scoreType: ScoreType) => {
  try {
    localStorage.setItem("leaderboard_score_type", scoreType);
  } catch (error) {
    console.warn("Failed to save score type to localStorage:", error);
  }
};

const setStoredTimeRange = (timeRange: "day" | "week" | "month" | "all") => {
  try {
    localStorage.setItem("leaderboard_time_range", timeRange);
  } catch (error) {
    console.warn("Failed to save time range to localStorage:", error);
  }
};

type ScoreType = "totalReps" | "totalSets" | "totalSteps";
type TimeRange = "day" | "week" | "month" | "all";

const LeaderboardComponent: React.FC = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoreType, setScoreType] = useState<ScoreType>(getStoredScoreType);
  const [timeRange, setTimeRange] = useState<TimeRange>(getStoredTimeRange);

  const previousEntriesRef = useRef<Map<string, number>>(new Map());
  const [channelStatus, setChannelStatus] = useState<string>(UI_STATUS.DISCONNECTED);
  const isMountedRef = useRef(true);
  const latestRequestRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Add ref to track if component has been fully initialized
  const isFullyInitializedRef = useRef(false);

  // Update channel status based on ActivitySyncService
  useEffect(() => {
    const updateChannelStatus = () => {
      const status = activitySyncService.getConnectionStatus();
      setChannelStatus(
        status.isSubscribed
          ? SUPABASE_CHANNEL_STATUS.SUBSCRIBED
          : SUPABASE_CHANNEL_STATUS.CHANNEL_ERROR
      );
    };

    updateChannelStatus();

    // Update every 2 seconds to keep status current
    const interval = setInterval(updateChannelStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchLeaderboardEntries = useCallback(async (): Promise<LeaderboardEntry[]> => {
    const { data, error } = await supabase.rpc("get_leaderboard", {
      p_metric: scoreType,
      p_time_range: timeRange,
    });

    if (error) throw error;

    return mapLeaderboardRows(
      (data ?? []) as LeaderboardRpcRow[],
      previousEntriesRef.current,
      new Date().toISOString(),
      (userId, score) => {
        // Delay updating the previous score to allow the flash animation to complete.
        setTimeout(() => {
          previousEntriesRef.current.set(userId, score);
        }, 1000); // 1 second to match the CSS animation duration
      }
    );
  }, [scoreType, timeRange]);

  // Memoize the main fetchLeaderboard function
  const fetchLeaderboard = useCallback(async () => {
    const requestId = ++latestRequestRef.current;

    try {
      const newEntries = await fetchLeaderboardEntries();

      if (isMountedRef.current && requestId === latestRequestRef.current) {
        setEntries(newEntries);
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      if (isMountedRef.current && requestId === latestRequestRef.current) {
        setError("Failed to load leaderboard");
      }
    }
  }, [fetchLeaderboardEntries]);

  // Update localStorage when scoreType changes
  useEffect(() => {
    setStoredScoreType(scoreType);
  }, [scoreType]);

  // Update localStorage when timeRange changes
  useEffect(() => {
    setStoredTimeRange(timeRange);
  }, [timeRange]);

  // Initial fetch when component mounts or dependencies change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Mark component as fully initialized after first data fetch
  useEffect(() => {
    if (entries.length > 0 || error) {
      isFullyInitializedRef.current = true;
    }
  }, [entries.length, error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isFullyInitializedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Create a stable reference for the fetch function
  const fetchLeaderboardRef = useRef(fetchLeaderboard);
  useEffect(() => {
    fetchLeaderboardRef.current = fetchLeaderboard;
  }, [fetchLeaderboard]);

  // Subscribe to activity sync service for real-time updates
  useEffect(() => {
    const unsubscribe = activitySyncService.subscribe(() => {
      // Refresh leaderboard data when new activities are added
      if (scoreType !== "totalSteps") {
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchLeaderboardRef.current();
          }
        }, 100);
      }
    });

    const unsubscribeOura = activitySyncService.subscribeToOura(() => {
      // Refresh leaderboard data when new Oura activities are added
      if (scoreType === "totalSteps") {
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchLeaderboardRef.current();
          }
        }, 100);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeOura();
    };
  }, [scoreType]);

  // Remove the old channel-based real-time subscription since we now use ActivitySyncService

  const getScoreLabel = useCallback((type: ScoreType) => {
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
  }, []);

  const getScoreUnit = useCallback((type: ScoreType) => {
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
  }, []);

  const handleScoreTypeChange = useCallback((type: ScoreType) => {
    setScoreType(type);
  }, []);

  const handleTimeRangeChange = useCallback((range: "day" | "week" | "month" | "all") => {
    setTimeRange(range);
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Leaderboard</h2>
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                channelStatus === SUPABASE_CHANNEL_STATUS.SUBSCRIBED
                  ? "bg-green-500"
                  : channelStatus === SUPABASE_CHANNEL_STATUS.CHANNEL_ERROR ||
                    channelStatus === UI_STATUS.ERROR
                  ? "bg-red-500"
                  : channelStatus === SUPABASE_CHANNEL_STATUS.TIMED_OUT ||
                    channelStatus === UI_STATUS.TIMEOUT
                  ? "bg-yellow-500"
                  : channelStatus === SUPABASE_CHANNEL_STATUS.CLOSED ||
                    channelStatus === UI_STATUS.CLOSED
                  ? "bg-gray-500"
                  : "bg-yellow-500"
              }`}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400 transition-opacity duration-300">
              {channelStatus === SUPABASE_CHANNEL_STATUS.SUBSCRIBED
                ? "Live"
                : channelStatus === SUPABASE_CHANNEL_STATUS.CHANNEL_ERROR ||
                  channelStatus === UI_STATUS.ERROR
                ? "Reconnecting..."
                : channelStatus === SUPABASE_CHANNEL_STATUS.TIMED_OUT ||
                  channelStatus === UI_STATUS.TIMEOUT
                ? "Reconnecting..."
                : channelStatus === SUPABASE_CHANNEL_STATUS.CLOSED ||
                  channelStatus === UI_STATUS.CLOSED
                ? "Reconnecting..."
                : channelStatus === UI_STATUS.CONNECTING || channelStatus === UI_STATUS.DISCONNECTED
                ? "Connecting..."
                : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto sm:flex-nowrap justify-between items-center mb-8">
          <div className="flex rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-sm">
            <div className="grid grid-cols-3">
              {["totalReps", "totalSets", "totalSteps"].map((type) => (
                <button
                  key={type}
                  onClick={() => handleScoreTypeChange(type as ScoreType)}
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
                  onClick={() => handleTimeRangeChange(range.value as TimeRange)}
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

export const Leaderboard = React.memo(LeaderboardComponent);
