import { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import { FriendActivity } from "./components/FriendActivity";
import { Friends } from "./components/Friends";
import OuraCallback from "./components/OuraCallback";
import TimerHeader from "./components/TimerHeader";
import { useTimerWorker } from "./contexts/TimerWorkerContext";
import { AppSettings } from "./types";
import { UserProfile } from "./types/social";
import { getUserLocation } from "./utils/socialService";
import { supabase } from "./utils/supabaseClient";

const TIMER_SOUND_PATH = "/sounds/timer-beep.mp3";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [timerComplete, setTimerComplete] = useState(false);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State for mobile menu open/close
  const [isTitleFlashing, setIsTitleFlashing] = useState(false); // State for title flashing

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

  // Preload the audio element
  useEffect(() => {
    audioRef.current = new Audio(TIMER_SOUND_PATH);
    audioRef.current.preload = "auto";
    audioRef.current.load();
  }, []);

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
        //console.log(`App.tsx: Fetched and set userProfile: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      console.error("App.tsx: Exception fetching/creating profile:", e);
      setUserProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      setSettings((prevSettings) => {
        const defaultAppSettings: AppSettings = {
          notificationsEnabled: userProfile.notifications_enabled ?? true,
          darkMode: window.matchMedia("(prefers-color-scheme: dark)").matches,
        };

        if (prevSettings === null) {
          return defaultAppSettings;
        } else {
          return {
            ...prevSettings,
            notificationsEnabled:
              userProfile.notifications_enabled ?? prevSettings.notificationsEnabled,
          };
        }
      });

      if (
        !isTimerActive &&
        (timeLeft === 0 || timeLeft !== userProfile.timer_duration) &&
        userProfile.timer_duration > 0
      ) {
        setTimeLeft(userProfile.timer_duration);
      }
    } else {
      if (timeLeft !== 0) {
        setTimeLeft(0);
      }
      setSettings(null);
    }
  }, [
    userProfile?.id,
    userProfile?.timer_duration,
    userProfile?.notifications_enabled,
    isTimerActive,
    timeLeft,
    setTimeLeft,
  ]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    console.log("App.tsx: Updating settings:", newSettings);
    setSettings((prev) => {
      if (prev === null) {
        return {
          notificationsEnabled: newSettings.notificationsEnabled ?? false,
          darkMode: newSettings.darkMode ?? false,
        };
      } else {
        return {
          ...prev,
          ...newSettings,
        };
      }
    });
  }, []);

  const handleStartTimer = useCallback(() => {
    if (!userProfile) return;
    const duration = userProfile.timer_duration;
    startWorkerTimer(duration);
    setIsTimerActive(true);
    setTimerComplete(false);
    setCurrentWorkoutComplete(false);
  }, [userProfile?.timer_duration, startWorkerTimer, setIsTimerActive]);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      // Reset the audio to the beginning
      audioRef.current.currentTime = 0;

      // Play the audio
      audioRef.current.play().catch((error) => {
        console.error("App.tsx: Error playing sound:", error);
        // If there's an error, try creating a new audio element
        const newAudio = new Audio(TIMER_SOUND_PATH);
        newAudio.play().catch((newError) => {
          console.error("App.tsx: Error playing sound with new audio element:", newError);
        });
      });
    } else {
      // Fallback if audioRef is not available
      const audio = new Audio(TIMER_SOUND_PATH);
      audio.play().catch((error) => {
        console.error("App.tsx: Error playing sound (fallback):", error);
      });
    }
  }, []);

  const showNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) {
      console.warn("App.tsx: This browser does not support desktop notification");
      return;
    }

    console.log("Current Notification.permission status:", Notification.permission);

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/favicon.svg", // Add an icon if you have one
        requireInteraction: true, // Keep notification until user interacts
        silent: false, // Allow system sound
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, {
            body,
            icon: "/favicon.svg",
            requireInteraction: true,
            silent: false,
          });
        }
      });
    }
  }, []);

  // Enhanced notification system with multiple attention-grabbing features
  const notifyTimerExpired = useCallback(() => {
    console.log("App.tsx: Timer expired - triggering enhanced notifications");

    // 1. Play sound
    playSound();

    // 2. Show desktop notification if tab is hidden
    if (document.hidden) {
      showNotification("⏰ Timer Expired!", "Your workout timer has finished! Time to get moving!");
    }

    // 3. Start title flashing
    setIsTitleFlashing(true);

    // 4. Try to focus the window/tab (may not work due to browser security)
    if (document.hidden) {
      // This is the most we can do to get attention
      window.focus();
    }

    // 5. Add visual feedback to the page
    document.body.classList.add("timer-expired-flash");

    // Stop the flashing after 10 seconds
    setTimeout(() => {
      setIsTitleFlashing(false);
      document.body.classList.remove("timer-expired-flash");
    }, 10000);
  }, [playSound, showNotification]);

  // Function to stop timer notifications
  const stopTimerNotifications = useCallback(() => {
    setIsTitleFlashing(false);
    document.body.classList.remove("timer-expired-flash");
  }, []);

  // Stop notifications when user interacts with the page
  useEffect(() => {
    const handleUserInteraction = () => {
      if (isTitleFlashing) {
        stopTimerNotifications();
      }
    };

    // Listen for various user interactions
    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);
    document.addEventListener("scroll", handleUserInteraction);

    return () => {
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      document.removeEventListener("scroll", handleUserInteraction);
    };
  }, [isTitleFlashing, stopTimerNotifications]);

  // Handle title flashing
  useEffect(() => {
    if (isTitleFlashing) {
      const interval = setInterval(() => {
        document.title =
          document.title === "⏰ TIMER EXPIRED! ⏰" ? "Dicey Movements" : "⏰ TIMER EXPIRED! ⏰";
      }, 1000);

      return () => {
        clearInterval(interval);
        document.title = "Dicey Movements"; // Reset title when component unmounts
      };
    } else {
      document.title = "Dicey Movements";
    }
  }, [isTitleFlashing]);

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
      notifyTimerExpired();
    }
  }, [timerComplete, notifyTimerExpired]);

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
        {/* Fixed Header Navigation */}
        {/* Moved padding to nav itself */}
        <nav className="bg-gray-800 shadow-lg fixed w-full z-50 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {" "}
            {/* This div is now just for max-width and centering */}
            <div className="flex items-center justify-between h-16">
              {/* Logo/Title (Left Section) */}
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400">Dicey</span>
                <span className="text-red-500 dark:text-red-400">Movements</span>
              </h1>

              {/* Desktop Navigation Links (Middle Section - Hidden on mobile) */}
              <div className="hidden md:flex flex-grow justify-center space-x-8">
                <Link to="/" className="nav-link">
                  Game
                </Link>
                {userProfile && showTimerHeader && (
                  <TimerHeader isActive={isTimerActive} timeLeft={timeLeft} />
                )}
                <Link to="/friends" className="nav-link">
                  Friends
                </Link>
                <Link to="/activity" className="nav-link">
                  Activity
                </Link>
              </div>

              {/* User Info & Sign Out (Right Section - Hidden on mobile) */}
              <div className="hidden md:flex items-center space-x-4 flex-shrink-0">
                <span className="text-sm font-medium text-gray-200">
                  Hey {userProfile?.first_name}!
                </span>
                <button onClick={() => supabase.auth.signOut()} className="btn-secondary">
                  Sign Out
                </button>
              </div>

              {/* Mobile Menu Button (Hamburger - Visible on mobile) */}
              <div className="-mr-2 flex md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  aria-controls="mobile-menu"
                  aria-expanded="false">
                  <span className="sr-only">Open main menu</span>
                  {/* Hamburger icon */}
                  {!isMenuOpen ? (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                  ) : (
                    <svg
                      className="block h-6 w-6"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Menu (Collapsible) */}
          {isMenuOpen && (
            <div className="md:hidden" id="mobile-menu">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link to="/" className="mobile-nav-link" onClick={() => setIsMenuOpen(false)}>
                  Game
                </Link>
                {userProfile && showTimerHeader && (
                  <div className="px-3 py-2 text-sm font-medium text-gray-200">
                    <TimerHeader isActive={isTimerActive} timeLeft={timeLeft} />
                  </div>
                )}
                <Link
                  to="/friends"
                  className="mobile-nav-link"
                  onClick={() => setIsMenuOpen(false)}>
                  Friends
                </Link>
                <Link
                  to="/activity"
                  className="mobile-nav-link"
                  onClick={() => setIsMenuOpen(false)}>
                  Activity
                </Link>
              </div>
              <div className="pt-4 pb-3 border-t border-gray-700">
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    {/* Placeholder User Avatar */}
                    <svg
                      className="h-8 w-8 rounded-full text-gray-300"
                      fill="currentColor"
                      viewBox="0 0 24 24">
                      <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z"></path>
                    </svg>
                  </div>
                  <div className="ml-3">
                    <div className="text-base font-medium leading-none text-white">
                      {userProfile?.first_name}
                    </div>
                    <div className="text-sm font-medium leading-none text-gray-400">
                      {session?.user?.email}
                    </div>
                  </div>
                </div>
                <div className="mt-3 px-2 space-y-1">
                  <button
                    onClick={() => {
                      supabase.auth.signOut();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700">
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Spacer div to push content below fixed header */}
        <div className="h-16"></div>

        {settings ? (
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  key={userProfile?.id || "loading"}
                  timerComplete={timerComplete}
                  setTimerComplete={setTimerComplete}
                  currentWorkoutComplete={currentWorkoutComplete}
                  setCurrentWorkoutComplete={setCurrentWorkoutComplete}
                  onStartTimer={handleStartTimer}
                  onResetTimerToDuration={resetTimerWorkerToDuration}
                  userProfile={userProfile}
                  setUserProfile={setUserProfile}
                />
              }
            />
            <Route path="/friends" element={<Friends />} />
            <Route path="/activity" element={<FriendActivity />} />
            <Route path="/oura/callback" element={<OuraCallback />} />
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
