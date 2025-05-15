import React, { useState } from 'react';
import { X } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPanelProps {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, 
  updateSettings, 
  onClose 
}) => {
  const [timerValue, setTimerValue] = useState<number>(settings.timerDuration);
  
  const handleSave = () => {
    updateSettings({
      timerDuration: timerValue,
    });
    onClose();
  };

  const toggleNotifications = () => {
    // If enabling notifications, request permission
    if (!settings.notificationsEnabled) {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          updateSettings({ notificationsEnabled: true });
        }
      });
    } else {
      updateSettings({ notificationsEnabled: false });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Settings</h2>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Timer Duration (seconds)
          </label>
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
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              1 min
            </button>
            <button 
              onClick={() => setTimerValue(300)} 
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              5 min
            </button>
            <button 
              onClick={() => setTimerValue(600)} 
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              10 min
            </button>
            <button 
              onClick={() => setTimerValue(1000)} 
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
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
                checked={settings.notificationsEnabled}
                onChange={toggleNotifications}
              />
              <div className={`block w-10 h-6 rounded-full ${settings.notificationsEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
              <div className={`absolute left-1 top-1 bg-white dark:bg-gray-300 w-4 h-4 rounded-full transition-transform ${settings.notificationsEnabled ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium">
              Enable Notifications
            </div>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-13">
            Receive notifications when your timer is complete
          </p>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;