import { Crown, Star, Target, Trophy, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { AchievementDefinition, achievements } from "../data/achievements";
import { AchievementProgress, AchievementService } from "../utils/achievementService";
import { supabase } from "../utils/supabaseClient";

interface AchievementsProps {
  userProfile?: any;
}

const rarityColors = {
  common: "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600",
  uncommon: "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600",
  rare: "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600",
  epic: "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600",
  legendary: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600",
};

const rarityIcons = {
  common: <Star size={16} className="text-gray-400" />,
  uncommon: <Star size={16} className="text-green-500" />,
  rare: <Zap size={16} className="text-blue-500" />,
  epic: <Crown size={16} className="text-purple-500" />,
  legendary: <Trophy size={16} className="text-yellow-500" />,
};

export const Achievements: React.FC<AchievementsProps> = ({ userProfile }) => {
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AchievementDefinition["type"] | "all">("all");
  const [selectedRarity, setSelectedRarity] = useState<AchievementDefinition["rarity"] | "all">(
    "all"
  );
  const [selectedStatus, setSelectedStatus] = useState<"all" | "completed" | "incomplete">("all");

  useEffect(() => {
    loadAchievements();
  }, [userProfile]);

  const loadAchievements = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const progress = await AchievementService.getAchievementProgress(user.id);
      console.log("Achievement progress loaded:", progress);
      console.log(
        "Completed achievements:",
        progress.filter((p) => p.isCompleted)
      );
      setAchievementProgress(progress);
    } catch (error) {
      console.error("Error loading achievements:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAchievements = achievements.filter((achievement) => {
    const progress = achievementProgress.find((p) => p.achievementId === achievement.id);
    const defaultProgress: AchievementProgress = {
      achievementId: achievement.id,
      currentValue: 0,
      targetValue: achievement.criteria.value,
      isCompleted: false,
    };
    const finalProgress = progress || defaultProgress;

    const typeMatch = selectedType === "all" || achievement.type === selectedType;
    const rarityMatch = selectedRarity === "all" || achievement.rarity === selectedRarity;
    const statusMatch =
      selectedStatus === "all" ||
      (selectedStatus === "completed" && finalProgress.isCompleted) ||
      (selectedStatus === "incomplete" && !finalProgress.isCompleted);

    return typeMatch && rarityMatch && statusMatch;
  });

  const getProgressPercentage = (progress: AchievementProgress) => {
    if (progress.isCompleted) return 100;
    return Math.min((progress.currentValue / progress.targetValue) * 100, 100);
  };

  const getTotalPoints = () => {
    return achievementProgress
      .filter((p) => p.isCompleted)
      .reduce((total, progress) => {
        const achievement = achievements.find((a) => a.id === progress.achievementId);
        return total + (achievement?.points || 0);
      }, 0);
  };

  const getCompletedCount = () => {
    return achievementProgress.filter((p) => p.isCompleted).length;
  };

  const getIncompleteCount = () => {
    return achievementProgress.filter((p) => !p.isCompleted).length;
  };

  const getFilteredCount = () => {
    return filteredAchievements.length;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trophy className="text-yellow-500" size={28} />
            Achievements
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {getCompletedCount()} of {achievements.length} completed • {getTotalPoints()} points
            earned
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {getIncompleteCount()} remaining • {getFilteredCount()} showing
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as any)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="all">All Types</option>
          <option value="streak">Streak</option>
          <option value="exercise">Exercise</option>
          <option value="social">Social</option>
          <option value="steps">Steps</option>
          <option value="milestone">Milestone</option>
        </select>

        <select
          value={selectedRarity}
          onChange={(e) => setSelectedRarity(e.target.value as any)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="all">All Rarities</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as any)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          <option value="all">All Statuses</option>
          <option value="completed">Completed ({getCompletedCount()})</option>
          <option value="incomplete">Incomplete ({getIncompleteCount()})</option>
        </select>
      </div>

      {/* Achievements Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((achievement) => {
          const progress = achievementProgress.find((p) => p.achievementId === achievement.id);

          // Create default progress if not found
          const defaultProgress: AchievementProgress = {
            achievementId: achievement.id,
            currentValue: 0,
            targetValue: achievement.criteria.value,
            isCompleted: false,
          };

          const finalProgress = progress || defaultProgress;
          const percentage = getProgressPercentage(finalProgress);
          const isCompleted = finalProgress.isCompleted;

          return (
            <div
              key={achievement.id}
              className={`relative p-4 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                isCompleted ? "opacity-100" : "opacity-60"
              } ${rarityColors[achievement.rarity]}`}>
              {/* Rarity Icon */}
              <div className="absolute top-2 right-2">{rarityIcons[achievement.rarity]}</div>

              {/* Achievement Icon */}
              <div className="text-4xl mb-3">{achievement.icon}</div>

              {/* Achievement Info */}
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {achievement.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {achievement.description}
              </p>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>
                    {finalProgress.currentValue} / {finalProgress.targetValue}
                  </span>
                  <span>{Math.round(percentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isCompleted ? "bg-green-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${percentage}%` }}></div>
                </div>
              </div>

              {/* Points */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {achievement.points} points
                </span>
                {isCompleted && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ Completed
                  </span>
                )}
              </div>

              {/* Completion Date */}
              {finalProgress.unlockedAt && (
                <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                  Unlocked {finalProgress.unlockedAt.toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-8">
          <Target className="mx-auto text-gray-400 mb-2" size={48} />
          <p className="text-gray-500 dark:text-gray-400">
            No achievements match the current filters.
          </p>
        </div>
      )}
    </div>
  );
};
