import React, { useState, useEffect } from "react";
import { X, Activity, Link, Unlink, CheckCircle, AlertCircle } from "lucide-react";
import { OuraService, OuraStatus } from "../utils/ouraService";
import { supabase } from "../utils/supabaseClient";

interface SettingsPanelProps {
  timerDuration: number;
  updateTimerDuration: (newDuration: number) => void;
  notificationsEnabled: boolean;
  updateNotificationsEnabled: (enabled: boolean) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  timerDuration,
  updateTimerDuration,
  notificationsEnabled,
  updateNotificationsEnabled,
  onClose,
}) => {
  const [timerValue, setTimerValue] = useState<number>(timerDuration);
  const [ouraStatus, setOuraStatus] = useState<OuraStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [ouraMessage, setOuraMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    // Attempt to load status from localStorage for instant UI
    const cachedStatus = localStorage.getItem("ouraConnectionStatus");
    if (cachedStatus) {
      try {
        setOuraStatus(JSON.parse(cachedStatus));
      } catch (e) {
        console.error("Error parsing cached Oura status", e);
      }
    }

    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        await checkOuraStatus(user.id);
      } else {
        setIsCheckingStatus(false);
      }
    };
    getCurrentUser();

    // Check URL parameters for Oura callback status
    const params = new URLSearchParams(window.location.search);
    const ouraStatus = params.get("oura");
    const errorMessage = params.get("message");

    if (ouraStatus === "success") {
      setOuraMessage({ type: "success", text: "Successfully connected to Oura Ring!" });
      // Remove the URL parameters
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ouraStatus === "error") {
      setOuraMessage({
        type: "error",
        text: `Failed to connect to Oura Ring. ${
          errorMessage ? decodeURIComponent(errorMessage) : "Please try again."
        }`,
      });
      // Remove the URL parameters
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const checkOuraStatus = async (userId: string) => {
    setIsCheckingStatus(true);
    try {
      const status = await OuraService.getStatus(userId);
      setOuraStatus(status);
      localStorage.setItem("ouraConnectionStatus", JSON.stringify(status));
    } catch (error) {
      console.error("Error checking Oura status:", error);
      // It might be good to clear the cached status on error
      localStorage.removeItem("ouraConnectionStatus");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleConnectOura = async () => {
    if (!currentUser) return;

    setIsConnecting(true);
    try {
      const authUrl = await OuraService.getAuthUrl(currentUser.id);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error connecting to Oura:", error);
      alert("Failed to connect to Oura. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectOura = async () => {
    if (!currentUser) return;

    setIsDisconnecting(true);
    try {
      await OuraService.disconnect(currentUser.id);
      const newStatus = { connected: false, hasValidToken: false };
      setOuraStatus(newStatus);
      localStorage.setItem("ouraConnectionStatus", JSON.stringify(newStatus));
    } catch (error) {
      console.error("Error disconnecting from Oura:", error);
      alert("Failed to disconnect from Oura. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSave = () => {
    updateTimerDuration(timerValue);
    onClose();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6">
        {/* Show Oura message if exists */}
        {ouraMessage && (
          <div
            className={`p-4 rounded-lg flex items-center space-x-2 ${
              ouraMessage.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            }`}>
            {ouraMessage.type === "success" ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{ouraMessage.text}</span>
          </div>
        )}

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
        </div>

        {/* Oura Ring Integration Section */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <Activity className="w-5 h-5 mr-2 text-purple-500" />
            <h3 className="text-lg font-medium">Oura Ring Integration</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Connection Status</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ouraStatus?.connected
                    ? ouraStatus.hasValidToken
                      ? "Connected and active"
                      : "Connected but token expired"
                    : "Not connected"}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  ouraStatus?.connected && ouraStatus?.hasValidToken
                    ? "bg-green-500"
                    : ouraStatus?.connected
                    ? "bg-yellow-500"
                    : "bg-gray-400"
                }`}
              />
            </div>

            {ouraStatus?.connected ? (
              <div className="space-y-2">
                <button
                  onClick={handleDisconnectOura}
                  disabled={isDisconnecting || isCheckingStatus}
                  className="w-full px-4 py-2 border border-red-300 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
                  {isDisconnecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect Oura
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnectOura}
                disabled={isConnecting || isCheckingStatus}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
                {isConnecting || isCheckingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isCheckingStatus ? "Checking Status..." : "Connecting..."}
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4 mr-2" />
                    Connect Oura Ring
                  </>
                )}
              </button>
            )}

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
