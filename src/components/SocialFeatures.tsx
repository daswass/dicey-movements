import { Activity, MapPin, Trophy, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { FriendActivity, LeaderboardEntry, UserProfile } from "../types/social";

interface SocialFeaturesProps {
  userProfile: UserProfile;
}

const SocialFeatures: React.FC<SocialFeaturesProps> = ({ userProfile }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friendActivities, setFriendActivities] = useState<FriendActivity[]>([]);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "friends">("leaderboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === "leaderboard") {
          // For now, use mock data
          const mockLeaderboard: LeaderboardEntry[] = [
            {
              userId: "1",
              username: "Das Wass",
              score: 148,
              location: userProfile.location.city,
              timestamp: new Date(),
            },
            {
              userId: "2",
              username: "Jilly Girl",
              score: 151,
              location: userProfile.location.city,
              timestamp: new Date(),
            },
            {
              userId: "3",
              username: "Ace Aurelia",
              score: 123,
              location: userProfile.location.city,
              timestamp: new Date(),
            },
          ];
          setLeaderboard(mockLeaderboard);
        } else {
          // For now, use mock data
          const mockActivities: FriendActivity[] = [
            {
              userId: "3",
              username: "Ace Aurelia",
              activity: {
                type: "workout",
                details: "Completed 50 push-ups",
                timestamp: new Date(),
              },
            },
          ];
          setFriendActivities(mockActivities);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab, userProfile.location.city]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === "leaderboard"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}>
          <Trophy size={20} />
          <span>Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === "friends"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}>
          <Users size={20} />
          <span>Friends</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">{error}</div>
      ) : (
        <>
          {activeTab === "leaderboard" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Top Performers</h3>
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <MapPin size={16} className="mr-1" />
                  {userProfile.location.city}
                </div>
              </div>
              <div className="space-y-2">
                {leaderboard
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 3)
                  .map((entry, index) => (
                    <div
                      key={entry.userId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-lg">{index + 1}</span>
                        <span>{entry.username}</span>
                      </div>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {entry.score} reps
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "friends" && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold mb-4">Friend Activity</h3>
              <div className="space-y-3">
                {friendActivities.map((activity) => (
                  <div
                    key={`${activity.userId}-${activity.activity.timestamp}`}
                    className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Activity size={20} className="text-blue-500 mt-1" />
                    <div>
                      <p className="font-medium">{activity.username}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {activity.activity.details}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(activity.activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SocialFeatures;
