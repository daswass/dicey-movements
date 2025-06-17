import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { getExerciseById } from "../data/exercises";

interface Activity {
  id: string;
  user_id: string;
  exercise_id: number;
  exercise_name: string;
  reps: number;
  multiplier: number;
  timestamp: string;
  profiles?: { username?: string; first_name?: string; last_name?: string };
  username: string;
}

export const FriendActivity: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOwnActivity, setShowOwnActivity] = useState(true);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month" | "all">("week");

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // First get the user's friends
      const { data: friendsData, error: friendsError } = await supabase
        .from("friends")
        .select("friend_id")
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (friendsError) throw friendsError;

      const friendIds = friendsData.map((f) => f.friend_id);
      if (showOwnActivity) {
        friendIds.push(user.id);
      }

      let query = supabase
        .from("activities")
        .select(`*, profiles!activities_user_id_fkey (username, first_name, last_name)`)
        .in("user_id", friendIds)
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
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
        }
        query = query.gte("timestamp", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setActivities(
        (data || []).map((activity) => ({
          ...activity,
          username:
            activity.profiles?.username ||
            `${activity.profiles?.first_name || ""} ${activity.profiles?.last_name || ""}`.trim() ||
            "Unknown User",
        }))
      );
    } catch (err) {
      console.error("Error fetching activities:", err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [showOwnActivity, timeRange]);

  return (
    <div className="max-w-4xl mx-auto p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Friend Activity</h2>
        <div className="flex space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOwnActivity}
              onChange={(e) => setShowOwnActivity(e.target.checked)}
              className="form-checkbox h-5 w-5 text-blue-500"
            />
            <span>Self</span>
          </label>

          {/* Time Range Segmented Control */}
          <div className="flex rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden">
            {[
              { label: "24h", value: "day" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
              { label: "All", value: "all" },
            ].map((range, idx, arr) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value as any)}
                className={`px-3 py-2 text-sm font-medium focus:outline-none transition-all duration-150
                  ${
                    timeRange === range.value
                      ? "bg-blue-500 text-white"
                      : "bg-transparent text-gray-700 dark:text-gray-200"
                  }
                  ${idx === 0 ? "rounded-l-lg" : idx === arr.length - 1 ? "rounded-r-lg" : ""}
                `}>
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

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400">No activities to show</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{activity.username}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {getExerciseById(activity.exercise_id).emoji} - {activity.exercise_name} -{" "}
                      {activity.reps} reps x {activity.multiplier}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(activity.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
