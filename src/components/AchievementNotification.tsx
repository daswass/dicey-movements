import { Crown, Star, Trophy, X, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getAchievementById } from "../data/achievements";

interface AchievementNotificationProps {
  achievementId: string;
  onClose: () => void;
}

const rarityIcons = {
  common: <Star size={20} className="text-gray-400" />,
  uncommon: <Star size={20} className="text-green-500" />,
  rare: <Zap size={20} className="text-blue-500" />,
  epic: <Crown size={20} className="text-purple-500" />,
  legendary: <Trophy size={20} className="text-yellow-500" />,
};

const rarityGradients = {
  common: "from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800",
  uncommon: "from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20",
  rare: "from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20",
  epic: "from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20",
  legendary: "from-yellow-100 to-yellow-200 dark:from-yellow-900/20 dark:to-yellow-800/20",
};

export const AchievementNotification: React.FC<AchievementNotificationProps> = ({
  achievementId,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const achievement = getAchievementById(achievementId);

  useEffect(() => {
    // Show notification with a slight delay for animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!achievement) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`transform transition-all duration-300 ease-out ${
          isVisible ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95"
        }`}>
        <div
          className={`relative bg-gradient-to-r ${
            rarityGradients[achievement.rarity]
          } border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-80 max-w-sm`}>
          {/* Close button */}
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>

          {/* Rarity icon */}
          <div className="absolute top-2 left-2">{rarityIcons[achievement.rarity]}</div>

          {/* Content */}
          <div className="flex items-start space-x-3 pt-6">
            {/* Achievement icon */}
            <div className="text-4xl flex-shrink-0">{achievement.icon}</div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <Trophy size={16} className="text-yellow-500" />
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                  Achievement Unlocked!
                </span>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                {achievement.name}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {achievement.description}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {achievement.points} points earned
                </span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {achievement.rarity}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar for visual effect */}
          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className="bg-green-500 h-1 rounded-full animate-pulse"
                style={{ width: "100%" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
