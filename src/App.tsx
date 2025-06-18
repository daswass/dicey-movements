import { Session } from "@supabase/supabase-js";
import { useEffect, useState, useRef, useCallback } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import { FriendActivity } from "./components/FriendActivity";
import { Friends } from "./components/Friends";
import TimerHeader from "./components/TimerHeader";
import { AppSettings } from "./types";
import { supabase } from "./utils/supabaseClient";
import { useTimerWorker } from "./contexts/TimerWorkerContext";
import { getUserLocation } from "./utils/socialService";
import { UserProfile } from "./types/social";

const TIMER_SOUND_PATH = "/sounds/timer-beep.mp3";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [timerComplete, setTimerComplete] = useState(false);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  const {
    isTimerActive,
    setIsTimerActive,
    timeLeft,
    setTimeLeft,
    startTimer: startWorkerTimer,
    stopTimer: stopWorkerTimer,
    pauseTimer: pauseWorkerTimer,
    resumeTimer: resumeWorkerTimer,
    resetTimerToDuration: resetTimerWorkerToDuration,
  } = useTimerWorker();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getDayOfWeek = () => {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    return days[new Date().getDay()];
  };

  useEffect(() => {
    setDayOfWeek(getDayOfWeek());
    const interval = setInterval(() => {
      setDayOfWeek(getDayOfWeek());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const showTimerHeader = isTimerActive;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session);
      } else {
        setLoadingProfile(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchUserProfile(session.user.id, session);
      } else {
        setLoadingProfile(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string, currentSession: Session | null) => {
    setLoadingProfile(true);
    try {
      let { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

      if (error && error.code === "PGRST116") {
        console.log("App.tsx: No profile found, attempting to create one.");
        const location = await getUserLocation();
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            username: currentSession?.user?.email?.split("@")[0],
            location,
          })
          .select("*")
          .single();

        if (newProfile && !createError) {
          setUserProfile({ ...newProfile, timer_duration: newProfile.timer_duration || 300 });
          console.log(`App.tsx: Created and set new userProfile: ${JSON.stringify(newProfile)}`);
        } else {
          console.error("App.tsx: Error creating new profile:", createError);
          setUserProfile(null);
        }
      } else if (error) {
        console.error("App.tsx: Error fetching user profile:", error);
        setUserProfile(null);
      } else if (data) {
        setUserProfile({ ...data, timer_duration: data.timer_duration || 300 });
        console.log(`App.tsx: Fetched and set userProfile: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      console.error("App.tsx: Exception fetching/creating profile:", e);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  // --- App Settings and timeLeft initialization ---
  useEffect(() => {
    if (userProfile) {
      console.log(
        `[App useEffect UserProfile.Duration] userProfile.timer_duration: ${userProfile.timer_duration}, timeLeft: ${timeLeft}, isActive: ${isTimerActive}`
      );

      setSettings({
        notificationsEnabled: userProfile.notifications_enabled,
        darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
      });

      // Refined condition to update timeLeft to userProfile.timer_duration:
      // This should happen if:
      // 1. The timer is NOT active (!isTimerActive)
      // 2. AND a valid duration exists (userProfile.timer_duration > 0)
      // 3. AND (timeLeft is currently 0 OR timeLeft is *exactly* the userProfile.timer_duration)
      //    This means it's either in a completed state (0) or already set to the full duration (initial state).
      //    It explicitly EXCLUDES the case where timeLeft is > 0 but < userProfile.timer_duration (i.e., a paused state).
      const shouldResetToFullDuration =
        !isTimerActive &&
        userProfile.timer_duration > 0 &&
        (timeLeft === 0 || timeLeft === userProfile.timer_duration);

      if (shouldResetToFullDuration) {
        // Only set timeLeft if it's not already the correct duration to avoid unnecessary re-renders
        if (timeLeft !== userProfile.timer_duration) {
          console.log(
            `[App useEffect InitTimeLeft] Resetting timeLeft from ${timeLeft} to ${userProfile.timer_duration} because it's idle/completed.`
          );
          setTimeLeft(userProfile.timer_duration);
        }
      }
    } else {
      // Handles cases where userProfile is null (e.g., logout)
      if (timeLeft !== 0) {
        console.log(
          `[App useEffect UserProfile.Duration] Resetting timeLeft to 0 due to null userProfile.`
        );
        setTimeLeft(0);
      }
      setSettings(null); // Ensure settings is null if userProfile is null
    }
  }, [userProfile, isTimerActive, timeLeft, setTimeLeft]);

  const handleStartTimer = useCallback(() => {
    if (!userProfile) return;
    const duration = userProfile.timer_duration;
    startWorkerTimer(duration);
    setIsTimerActive(true);
    setTimerComplete(false);
    setCurrentWorkoutComplete(false);
  }, [userProfile, startWorkerTimer, setIsTimerActive]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    console.log("App.tsx: Updating settings:", newSettings);
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .catch((error) => console.error("App.tsx: Error playing sound:", error));
    } else {
      audioRef.current = new Audio(TIMER_SOUND_PATH);
      audioRef.current
        .play()
        .catch((error) => console.error("App.tsx: Error playing sound (initial):", error));
    }
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) {
      console.warn("App.tsx: This browser does not support desktop notification");
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body });
        }
      });
    }
  }, []);

  useEffect(() => {
    if (timeLeft === 0 && isTimerActive) {
      setTimerComplete(true);
      setIsTimerActive(false);
      setCurrentWorkoutComplete(false);
    }
  }, [timeLeft, isTimerActive, setIsTimerActive]);

  useEffect(() => {
    if (timerComplete) {
      console.log("App.tsx: Timer has completed! Playing sound and checking for notification.");
      playSound();

      if (document.hidden) {
        console.log("App.tsx: Tab is hidden, sending notification.");
        showNotification("Timer Expired!", "Your workout timer has finished.");
      }
    }
  }, [timerComplete, playSound, showNotification]);

  if (!session) {
    return <Auth />;
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading user profile...</p>
        </div>
      </div>
    );
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
                    <TimerHeader isActive={isTimerActive} timeLeft={timeLeft} />
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

        {settings ? (
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
                  onPauseTimer={pauseWorkerTimer}
                  onResumeTimer={resumeWorkerTimer}
                  onStopTimer={stopWorkerTimer}
                  onResetTimerToDuration={resetTimerWorkerToDuration}
                  timeLeft={timeLeft}
                  isTimerActive={isTimerActive}
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                />
              }
            />
            <Route path="/friends" element={<Friends />} />
            <Route path="/activity" element={<FriendActivity />} />
          </Routes>
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p>An error occurred or settings could not be loaded.</p>
          </div>
        )}

        <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          © {new Date().getFullYear()} Wassercise | POWER {dayOfWeek}!
        </footer>
      </div>
    </Router>
  );
}

export default App;
