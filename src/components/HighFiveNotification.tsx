import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

interface HighFiveNotificationProps {
  senderName: string;
  activity: string;
  onClose: () => void;
  index?: number; // Add index for stacking
}

export const HighFiveNotification: React.FC<HighFiveNotificationProps> = ({
  senderName,
  activity,
  onClose,
  index = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show notification with a slight delay for animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-hide after 4 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Calculate vertical position based on index
  const topOffset = 16 + index * 140; // 16px from top + 140px per notification

  return (
    <div className="fixed right-4 z-50" style={{ top: `${topOffset}px` }}>
      <div
        className={`transform transition-all duration-300 ease-out ${
          isVisible ? "translate-x-0 opacity-100 scale-100" : "translate-x-full opacity-0 scale-95"
        }`}>
        <div className="relative bg-gradient-to-r from-yellow-100 to-yellow-200 dark:from-yellow-800 dark:to-yellow-700 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg shadow-lg p-4 min-w-80 max-w-sm">
          {/* Close button */}
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <X size={16} />
          </button>

          {/* Content */}
          <div className="flex items-start space-x-3 pt-6">
            {/* High five icon */}
            <div className="text-4xl flex-shrink-0">✋</div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                  High Five!
                </span>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">
                {senderName} gave you a high five!
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                For completing: {activity}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Great job! 💪</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">✋</span>
              </div>
            </div>
          </div>

          {/* Progress bar for visual effect */}
          <div className="mt-3 pt-2 border-t border-yellow-200 dark:border-yellow-600">
            <div className="w-full bg-yellow-200 dark:bg-yellow-700 rounded-full h-1">
              <div
                className="bg-yellow-500 h-1 rounded-full animate-pulse"
                style={{ width: "100%" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
