import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import { FriendActivity } from "./components/FriendActivity";
import { Friends } from "./components/Friends";
import TimerHeader from "./components/TimerHeader";
import { AppSettings } from "./types";
import { loadFromLocalStorage } from "./utils/storage";
import { supabase } from "./utils/supabaseClient";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const savedSettings = loadFromLocalStorage("settings");
    if (savedSettings) return savedSettings;
    return {
      timerDuration: 60,
      notificationsEnabled: true,
      darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
    };
  });
  const [timerComplete, setTimerComplete] = useState(false);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.timerDuration);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Only show TimerHeader if timer is actually running
  const showTimerHeader = isTimerActive;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

    if (data && !error) {
      setUserProfile(data);
    }
  };

  const handleTimerComplete = () => {
    setTimerComplete(true);
    setCurrentWorkoutComplete(false);
    setIsTimerActive(false);
  };

  const handleWorkoutComplete = () => {
    setCurrentWorkoutComplete(true);
    setTimerComplete(false);
    setIsTimerActive(false);
  };

  const handleStartTimer = () => {
    setTimeLeft(settings.timerDuration);
    setIsTimerActive(true);
  };

  // Provide a wrapper for updateSettings to match Dashboard's expected type
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <nav className="bg-gray-800 shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold">Dicey Movements</span>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                    isTimerActive && timeLeft <= 10 ? "animate-pulse text-red-500" : ""
                  }`}>
                  Game
                </Link>
                {showTimerHeader && (
                  <TimerHeader
                    duration={settings.timerDuration}
                    onComplete={handleTimerComplete}
                    resetSignal={currentWorkoutComplete}
                    isActive={isTimerActive}
                    timeLeft={timeLeft}
                    setTimeLeft={setTimeLeft}
                  />
                )}

                <Link
                  to="/friends"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                  Friends
                </Link>
                <Link
                  to="/activity"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                  Activity
                </Link>
                <span className="text-sm font-medium">
                  {userProfile?.first_name} {userProfile?.last_name}
                </span>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                session={session}
                settings={settings}
                updateSettings={updateSettings}
                timerComplete={timerComplete}
                setTimerComplete={setTimerComplete}
                currentWorkoutComplete={currentWorkoutComplete}
                setCurrentWorkoutComplete={setCurrentWorkoutComplete}
                onStartTimer={handleStartTimer}
                timeLeft={timeLeft}
                setTimeLeft={setTimeLeft}
                isTimerActive={isTimerActive}
                setIsTimerActive={setIsTimerActive}
              />
            }
          />
          <Route path="/friends" element={<Friends />} />
          <Route path="/activity" element={<FriendActivity />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
