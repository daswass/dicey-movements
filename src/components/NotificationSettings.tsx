import { Bell, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import { notificationService } from "../utils/notificationService";

interface NotificationSettings {
  timer_expired: boolean;
  achievements: boolean;
  friend_activity: boolean;
  friend_requests: boolean;
}

interface NotificationSettingsProps {
  userProfile: any; // UserProfile type
  className?: string;
  onUpdate?: (updatedSettings: any) => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  userProfile,
  className = "",
  onUpdate,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    timer_expired: true,
    achievements: false,
    friend_activity: false,
    friend_requests: false,
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check if device is mobile
  const isMobile = () => {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  useEffect(() => {
    if (userProfile?.notification_settings) {
      setSettings(userProfile.notification_settings);
    }
  }, [userProfile]);

  const updateNotificationSetting = async (
    setting: keyof NotificationSettings,
    enabled: boolean
  ) => {
    try {
      setIsUpdating(true);
      const data = await api.updateNotificationSetting(userProfile.id, setting, enabled);
      setSettings(data.settings);

      // Update the parent component's user profile
      if (onUpdate) {
        onUpdate({
          ...userProfile,
          notification_settings: data.settings,
        });
      }

      console.log(`Updated ${setting} to ${enabled}`);
    } catch (error) {
      console.error("Error updating notification setting:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const forceRefreshSubscription = async () => {
    try {
      setIsRefreshing(true);
      console.log("NotificationSettings: Force refreshing subscription...");

      // Force refresh the subscription
      await notificationService.subscribeToPushNotifications(true);

      console.log("NotificationSettings: Subscription refreshed successfully");
    } catch (error) {
      console.error("NotificationSettings: Error refreshing subscription:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSettingIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-gray-400" />
    );
  };

  const getSettingDescription = (setting: keyof NotificationSettings) => {
    switch (setting) {
      case "timer_expired":
        return "Get notified when your workout timer expires";
      case "achievements":
        return "Get notified when you unlock new achievements";
      case "friend_activity":
        return "Get notified when friends complete workouts";
      case "friend_requests":
        return "Get notified when someone sends you a friend request";
      default:
        return "";
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <Bell className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-medium">Notification Preferences</h3>
      </div>

      <div className="space-y-3">
        {Object.entries(settings).map(([setting, enabled]) => (
          <div
            key={setting}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <div className="flex items-center space-x-3 flex-1">
              {getSettingIcon(enabled)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {setting.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getSettingDescription(setting as keyof NotificationSettings)}
                </p>
              </div>
            </div>

            <button
              onClick={() =>
                updateNotificationSetting(setting as keyof NotificationSettings, !enabled)
              }
              disabled={isUpdating}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                enabled ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"
              } ${isUpdating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Mobile-only refresh subscription button */}
      {isMobile() && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Refresh Notifications
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Force refresh notification subscription (mobile only)
              </p>
            </div>
            <button
              onClick={forceRefreshSubscription}
              disabled={isRefreshing}
              className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isRefreshing
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      )}

      {isUpdating && (
        <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span>Updating settings...</span>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
