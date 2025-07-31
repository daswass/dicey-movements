import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";
import { OuraService, type OuraStatus } from "../utils/ouraService";
import NotificationPermission from "./NotificationPermission";
import NotificationSettings from "./NotificationSettings";
import { Activity, CheckCircle, XCircle, RefreshCw, Link, Unlink } from "lucide-react";

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
  const [ouraStatus, setOuraStatus] = useState<OuraStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getCurrentUser();
  }, []);

  // Load Oura status when component mounts
  useEffect(() => {
    if (currentUser?.id) {
      loadOuraStatus();
    }
  }, [currentUser?.id]);

  const loadOuraStatus = async () => {
    try {
      const status = await OuraService.getStatus(currentUser.id);
      setOuraStatus(status);
    } catch (error) {
      console.error("Error loading Oura status:", error);
      setOuraStatus({ connected: false, hasValidToken: false });
    }
  };

  const handleConnectOura = async () => {
    if (!currentUser?.id) return;

    setIsConnecting(true);
    try {
      const authUrl = await OuraService.getAuthUrl(currentUser.id);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error getting Oura auth URL:", error);
      alert("Failed to start Oura connection. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectOura = async () => {
    if (!currentUser?.id) return;

    setIsDisconnecting(true);
    try {
      await OuraService.disconnect(currentUser.id);
      await loadOuraStatus();
    } catch (error) {
      console.error("Error disconnecting Oura:", error);
      alert("Failed to disconnect Oura. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSyncOura = async () => {
    if (!currentUser?.id) return;

    setIsSyncing(true);
    setSyncMessage("Syncing activity data...");
    try {
      await OuraService.syncActivity(currentUser.id, 7);
      setSyncMessage("Activity data synced successfully!");
      setTimeout(() => setSyncMessage(""), 3000);
    } catch (error) {
      console.error("Error syncing Oura activity:", error);
      setSyncMessage("Failed to sync activity data. Please try again.");
      setTimeout(() => setSyncMessage(""), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-purple-500" />
              <h3 className="text-lg font-medium">Oura Ring Integration</h3>
            </div>
            {/* Connection Status */}
            <div className="flex items-center">
              {ouraStatus?.connected ? (
                <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500 mr-1" />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {ouraStatus?.connected ? "Connected" : "Not Connected"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Connect your Oura Ring to automatically sync your activity. Data syncs periodically
              throughout the day.
            </p>

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {!ouraStatus?.connected ? (
                <button
                  onClick={handleConnectOura}
                  disabled={isConnecting}
                  className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Link className="w-4 h-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Oura Ring"}
                </button>
              ) : (
                <button
                  onClick={handleDisconnectOura}
                  disabled={isDisconnecting}
                  className="flex items-center px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Unlink className="w-3 h-3 mr-1" />
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              )}
            </div>

            {/* Sync Message */}
            {syncMessage && (
              <div
                className={`text-sm p-2 rounded ${
                  syncMessage.includes("successfully")
                    ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                }`}>
                {syncMessage}
              </div>
            )}
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
