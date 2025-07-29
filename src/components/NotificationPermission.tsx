import { Bell, BellOff, CheckCircle, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { NotificationPermission } from "../utils/notificationService";
import { notificationService } from "../utils/notificationService";

interface NotificationPermissionProps {
  onPermissionChange?: (permission: NotificationPermission) => void;
  className?: string;
}

const NotificationPermission: React.FC<NotificationPermissionProps> = ({
  onPermissionChange,
  className = "",
}) => {
  const [permission, setPermission] = useState<NotificationPermission>({
    permission: "default",
    supported: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    initializeNotificationService();
  }, []);

  const initializeNotificationService = async () => {
    try {
      await notificationService.initialize();
      const currentPermission = await notificationService.getPermissionStatus();

      setPermission(currentPermission);
      setIsLoading(false);

      // Show prompt if permission is default and notifications are supported
      if (currentPermission.permission === "default" && currentPermission.supported) {
        setShowPrompt(true);
      }

      onPermissionChange?.(currentPermission);
    } catch (error) {
      console.error("Error initializing notification service:", error);
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const newPermission = await notificationService.requestPermission();
      setPermission(newPermission);
      setShowPrompt(false);
      onPermissionChange?.(newPermission);

      if (newPermission.permission === "granted") {
        // Try to subscribe to push notifications
        await notificationService.subscribeToPushNotifications();
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDenyPermission = () => {
    setShowPrompt(false);
  };

  const getPermissionStatusIcon = () => {
    if (permission.permission === "granted") {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (permission.permission === "denied") {
      return <XCircle className="w-5 h-5 text-red-500" />;
    } else {
      return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  const getPermissionStatusText = () => {
    if (!permission.supported) {
      return "Notifications not supported";
    }

    switch (permission.permission) {
      case "granted":
        return "Notifications enabled";
      case "denied":
        return "Notifications blocked";
      default:
        return "Notifications not set";
    }
  };

  const getPermissionStatusColor = () => {
    if (!permission.supported) {
      return "text-gray-500";
    }

    switch (permission.permission) {
      case "granted":
        return "text-green-600 dark:text-green-400";
      case "denied":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 text-sm ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-gray-600 dark:text-gray-400">Checking notifications...</span>
      </div>
    );
  }

  if (!permission.supported) {
    return (
      <div className={`flex items-center space-x-2 text-sm ${className}`}>
        <BellOff className="w-5 h-5 text-gray-400" />
        <span className="text-gray-500">Push notifications not supported</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Permission Status Display */}
      <div className="flex items-center space-x-2 text-sm">
        {getPermissionStatusIcon()}
        <span className={getPermissionStatusColor()}>{getPermissionStatusText()}</span>
      </div>

      {/* Permission Request Prompt */}
      {showPrompt && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start space-x-3">
            <Bell className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Enable Push Notifications
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Get notified when your timer expires, even when the app is in the background.
              </p>
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={handleRequestPermission}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors">
                  {isLoading ? "Requesting..." : "Allow"}
                </button>
                <button
                  onClick={handleDenyPermission}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 rounded-md transition-colors">
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Denied Message */}
      {permission.permission === "denied" && (
        <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start space-x-2">
            <XCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Notifications are blocked. To enable them, click the notification icon in your
                browser's address bar and select "Allow".
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPermission;
