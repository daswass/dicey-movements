import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import NotificationPermission from "./NotificationPermission";
import NotificationSettings from "./NotificationSettings";

interface SettingsPanelProps {
  timerDuration: number;
  updateTimerDuration: (newDuration: number) => void;
  notificationsEnabled: boolean;
  updateNotificationsEnabled: (enabled: boolean) => void;
  userProfile: any; // UserProfile type
  onClose: () => void;
  onUserProfileUpdate?: (updatedProfile: any) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  timerDuration,
  updateTimerDuration,
  notificationsEnabled,
  updateNotificationsEnabled,
  userProfile,
  onClose,
  onUserProfileUpdate,
}) => {
  const [timerValue, setTimerValue] = useState<number>(timerDuration);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  const handleSave = () => {
    updateTimerDuration(timerValue);
    onClose();
  };

  const handleToggleNotifications = () => {
    updateNotificationsEnabled(!notificationsEnabled);
  };

  return (
    <div>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Timer Duration (seconds)</label>
          <input
            type="number"
            min="10"
            value={timerValue}
            onChange={(e) => setTimerValue(parseInt(e.target.value) || 10)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-between mt-2">
            <button
              onClick={() => setTimerValue(60)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
              1 min
            </button>
            <button
              onClick={() => setTimerValue(300)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
              5 min
            </button>
            <button
              onClick={() => setTimerValue(600)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
              10 min
            </button>
            <button
              onClick={() => setTimerValue(1000)}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
              Default
            </button>
          </div>
        </div>
        <div>
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={notificationsEnabled}
                onChange={(e) => updateNotificationsEnabled(e.target.checked)}
              />
              <div
                className={`block w-10 h-6 rounded-full ${
                  notificationsEnabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
                }`}></div>
              <div
                className={`absolute left-1 top-1 bg-white dark:bg-gray-300 w-4 h-4 rounded-full transition-transform ${
                  notificationsEnabled ? "transform translate-x-4" : ""
                }`}></div>
            </div>
            <div className="ml-3 text-sm font-medium">Enable Notifications</div>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-13">
            Receive notifications when your timer is complete
          </p>

          {/* Push Notification Permission */}
          <div className="mt-4">
            <NotificationPermission />
          </div>

          {/* Notification Settings */}
          {userProfile && (
            <div className="mt-6">
              <NotificationSettings userProfile={userProfile} onUpdate={onUserProfileUpdate} />
            </div>
          )}
        </div>

        {/* Oura Ring Integration Section */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-medium">Oura Ring Integration</h3>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Connect your Oura Ring to automatically sync your activity. Data syncs periodically
              throughout the day.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
