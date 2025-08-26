import { Trophy, Users, Dumbbell } from "lucide-react";
import React, { useState } from "react";
import { UserProfile } from "../types/social";
import { FriendActivity } from "./FriendActivity";
import { Leaderboard } from "./Leaderboard";
import SplitSelector from "./SplitSelector";

interface SocialFeaturesProps {
  userProfile: UserProfile;
  selectedSplitId: string;
  onSplitChange: (splitId: string) => void;
}

const SocialFeatures: React.FC<SocialFeaturesProps> = ({
  userProfile,
  selectedSplitId,
  onSplitChange,
}) => {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "friends" | "splits">("leaderboard");

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
        <button
          onClick={() => setActiveTab("splits")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === "splits"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}>
          <Dumbbell size={20} />
          <span>Splits</span>
        </button>
      </div>

      {/* Always render all components but control visibility */}
      <div className={`${activeTab === "leaderboard" ? "block" : "hidden"}`}>
        <Leaderboard />
      </div>
      <div className={`${activeTab === "friends" ? "block" : "hidden"}`}>
        <FriendActivity />
      </div>
      <div className={`${activeTab === "splits" ? "block" : "hidden"}`}>
        <SplitSelector selectedSplitId={selectedSplitId} onSplitChange={onSplitChange} />
      </div>
    </div>
  );
};

export default SocialFeatures;
