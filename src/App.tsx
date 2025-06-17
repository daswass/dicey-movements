import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import { FriendActivity } from "./components/FriendActivity";
import { Friends } from "./components/Friends";
import TimerHeader from "./components/TimerHeader";
import { AppSettings } from "./types";
import { supabase } from "./utils/supabaseClient";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [timerComplete, setTimerComplete] = useState(false);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dayOfWeek, setDayOfWeek] = useState<string>("");

  const getDayOfWeek = () => {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    return days[new Date().getDay()];
  };

  // update fay of week every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDayOfWeek(getDayOfWeek());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (userProfile) {
      setSettings({
        notificationsEnabled: userProfile.notifications_enabled,
        darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      });
    }
  }, [userProfile]);

  const handleTimerComplete = () => {
    setTimerComplete(true);
    setCurrentWorkoutComplete(false);
    setIsTimerActive(false);
  };

  useEffect(() => {
    console.log("Timer state changed - timeLeft:", timeLeft, "isActive:", isTimerActive);
  }, [timeLeft, isTimerActive]);

  useEffect(() => {
    setTimeLeft(userProfile?.timer_duration);
  }, [userProfile?.timer_duration]);

  // Provide a wrapper for updateSettings to match Dashboard's expected type
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    console.log("Updating settings:", newSettings);
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleStartTimer = () => {
    if (!userProfile) return;

    // Only set timeLeft if it's at the full duration (not paused)
    const duration = userProfile.timer_duration;
    if (timeLeft === duration) {
      console.log("handleStartTimer called - setting duration to", duration);
      setTimeLeft(duration);
    }

    setIsTimerActive(true);
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
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">Dicey</span>
                <span className="text-red-500 dark:text-red-400">Movements</span>
              </h1>
              {/* Name and sign out all the way to the right */}
              <div className="flex items-center space-x-8 ml-auto">
                <div className="flex items-center space-x-8">
                  <Link
                    to="/"
                    className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ${
                      isTimerActive && timeLeft <= 10 ? "animate-pulse text-red-500" : ""
                    }`}>
                    Game
                  </Link>
                  {userProfile && showTimerHeader && (
                    <TimerHeader
                      duration={userProfile.timer_duration}
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
                </div>

                <div className="flex items-center space-x-4 ml-auto">
                  <span className="text-sm font-medium">Hey {userProfile?.first_name}!</span>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {settings && (
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
        )}

        <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          © {new Date().getFullYear()} Wassercise | POWER {dayOfWeek}!
        </footer>
      </div>
    </Router>
  );
}

export default App;
