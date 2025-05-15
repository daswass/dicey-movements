import React, { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { AppSettings } from "./types";
import Dashboard from "./components/Dashboard";
import { loadFromLocalStorage, saveToLocalStorage } from "./utils/storage";

const getDayOfWeek = () => {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  return days[new Date().getDay()];
};

function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = loadFromLocalStorage("settings");
    const defaultSettings = {
      timerDuration: 1000,
      notificationsEnabled: true,
      darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
    };
    return { ...defaultSettings, ...(savedSettings || {}) };
  });

  useEffect(() => {
    saveToLocalStorage("settings", settings);
    if (settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings]);

  const toggleDarkMode = () => {
    setSettings((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        settings.darkMode ? "dark bg-gray-900 text-white" : "bg-gray-50 text-gray-900"
      }`}>
      <header className="px-4 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">Dicey</span>
          <span className="text-red-500 dark:text-red-400">Movements</span>
        </h1>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="container mx-auto p-4">
        <Dashboard
          settings={settings}
          updateSettings={(newSettings) => setSettings({ ...settings, ...newSettings })}
        />
      </main>

      <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        © {new Date().getFullYear()} Dicey Movements | POWER {getDayOfWeek()}!
      </footer>
    </div>
  );
}

export default App;
