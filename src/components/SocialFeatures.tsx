import { Trophy, Users } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const Leaderboard = lazy(() =>
  import("./Leaderboard").then((module) => ({ default: module.Leaderboard }))
);
const FriendActivity = lazy(() =>
  import("./FriendActivity").then((module) => ({ default: module.FriendActivity }))
);

function TabLoading() {
  return (
    <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      Loading...
    </div>
  );
}

const SocialFeatures = () => {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "friends">("leaderboard");

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

      {activeTab === "leaderboard" && (
        <Suspense fallback={<TabLoading />}>
          <Leaderboard />
        </Suspense>
      )}
      {activeTab === "friends" && (
        <Suspense fallback={<TabLoading />}>
          <FriendActivity />
        </Suspense>
      )}
    </div>
  );
};

export default SocialFeatures;
