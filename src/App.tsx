import { useCallback, useEffect, useState, lazy, Suspense, type Dispatch, type SetStateAction } from "react";
import { Link, Route, BrowserRouter as Router, Routes, useLocation } from "react-router-dom";
import AppNav from "./components/AppNav";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import { HighFiveEffect } from "./components/HighFiveEffect";
import { HighFiveNotification } from "./components/HighFiveNotification";
import { useAuth } from "./contexts/AuthContext";
import { useTimerNotifications } from "./hooks/useTimerNotifications";
import { useTimerSync } from "./hooks/useTimerSync";
import { useTimerWorker } from "./contexts/TimerWorkerContext";
import { AppSettings } from "./types";
import { activitySyncService } from "./utils/activitySyncService";
import { notificationService } from "./utils/notificationService";
import {
  fetchPendingFriendRequests,
  sendHighFive,
} from "./utils/socialService";
import { timerSyncService } from "./utils/timerSyncService";

const Friends = lazy(() => import("./components/Friends").then((m) => ({ default: m.Friends })));
const FriendActivity = lazy(() =>
  import("./components/FriendActivity").then((m) => ({ default: m.FriendActivity }))
);
const ZoneMap = lazy(() => import("./components/ZoneMap"));
const OuraCallback = lazy(() => import("./components/OuraCallback"));
const PrivacyPolicy = lazy(() => import("./components/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));

function RouteLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
    </div>
  );
}

function RouteAwareFriendEffects({
  userProfileId,
  refreshPendingFriendRequests,
  setPendingFriendRequests,
  setShowFriendRequestNotification,
}: {
  userProfileId: string | undefined;
  refreshPendingFriendRequests: () => Promise<void>;
  setPendingFriendRequests: Dispatch<SetStateAction<number>>;
  setShowFriendRequestNotification: Dispatch<SetStateAction<boolean>>;
}) {
  const location = useLocation();

  useEffect(() => {
    if (!userProfileId) return;

    fetchPendingFriendRequests().then((requests) => {
      setPendingFriendRequests(requests);
      if (requests > 0 && location.pathname === "/") {
        setShowFriendRequestNotification(true);
        setTimeout(() => {
          setShowFriendRequestNotification(false);
        }, 5000);
      }
    });
  }, [userProfileId, setPendingFriendRequests, setShowFriendRequestNotification, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/friends") {
      refreshPendingFriendRequests();
    }
  }, [location.pathname, refreshPendingFriendRequests]);

  return null;
}

function App() {
  const { session, userProfile, loading: loadingProfile, setUserProfile, signOut } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [timerComplete, setTimerComplete] = useState(false);
  const [currentWorkoutComplete, setCurrentWorkoutComplete] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState(0);
  const [showFriendRequestNotification, setShowFriendRequestNotification] = useState(false);
  const [showHighFiveEffect, setShowHighFiveEffect] = useState(false);
  const [highFiveNotifications, setHighFiveNotifications] = useState<
    Array<{
      id: string;
      senderName: string;
      activity: string;
    }>
  >([]);

  const {
    isTimerActive,
    setIsTimerActive,
    timeLeft,
    setTimeLeft,
    startTimer: startWorkerTimer,
    stopTimer: stopWorkerTimer,
    resetTimerToDuration: resetTimerWorkerToDuration,
  } = useTimerWorker();

  const { notificationSentRef, resetNotificationFlags } = useTimerNotifications({
    timerComplete,
    setTimerComplete,
    isTimerActive,
    timeLeft,
    setIsTimerActive,
    setCurrentWorkoutComplete,
  });

  useTimerSync({
    timerComplete,
    setTimerComplete,
    isTimerActive,
    setIsTimerActive,
    setTimeLeft,
    setCurrentWorkoutComplete,
    startWorkerTimer,
    stopWorkerTimer,
  });

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

  // Initialize notification service
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
      } catch (error) {
        console.error("App.tsx: Error initializing notifications:", error);
      }
    };

    initializeNotifications();
  }, []);

  // Listen for timer completion from notification clicks
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data.type === "TIMER_COMPLETE_FROM_NOTIFICATION") {
        console.log("App.tsx: Timer complete message received from notification");

        // Check if we're on the roll dice screen (timerComplete && !currentWorkoutComplete)
        // This handles the cross-device scenario where user taps notification on mobile
        // but then rolls dice on desktop
        if (timerComplete && !currentWorkoutComplete) {
          console.log("App.tsx: On roll dice screen, resetting timer state");
          setTimerComplete(false);
          setCurrentWorkoutComplete(false);
          stopWorkerTimer();
          setTimeLeft(0);
          setIsTimerActive(false);

          // Transfer master control to this device since user is interacting
          if (!timerSyncService.isDeviceMasterSync()) {
            timerSyncService.becomeMaster();
          }
        } else {
          console.log("App.tsx: Not on roll dice screen, just marking as complete");
          setTimerComplete(true);
          setCurrentWorkoutComplete(false);
          stopWorkerTimer();
          setTimeLeft(0);
          setIsTimerActive(false);
        }

        // Set a flag to prevent sending another notification
        sessionStorage.setItem("openedFromNotification", "true");
      }

      // Handle high five notification
      if (event.data.type === "HIGH_FIVE_FROM_NOTIFICATION") {
        const notificationData = event.data.notificationData;

        // Only show the high five effect if this notification is intended for the current user
        if (session?.user?.id && notificationData?.recipientUserId === session.user.id) {
          setShowHighFiveEffect(true);
          // Show internal notification with data from the notification
          if (notificationData?.friendName) {
            // Use the activity from the notification if available, otherwise use generic text
            const activity = notificationData.activity || "your activity";
            addHighFiveNotification(notificationData.friendName, activity);

            // If this is from a notification action (friend activity), send a high five TO the friend
            if (notificationData.fromNotificationAction && notificationData.friendId) {
              try {
                const success = await sendHighFive(
                  notificationData.friendId,
                  notificationData.activity
                );
                if (success) {
                  console.log(
                    "App.tsx: High five sent successfully to friend via notification action"
                  );
                } else {
                  console.warn(
                    "App.tsx: Failed to send high five to friend via notification action"
                  );
                }
              } catch (error) {
                console.error(
                  "App.tsx: Error sending high five to friend via notification action:",
                  error
                );
              }
            }
          }
        } else {
          console.log("App.tsx: High five notification not intended for current user, ignoring");
        }
      }

      // Handle reset notification state message
      if (event.data.type === "RESET_NOTIFICATION_STATE") {
        resetNotificationFlags();
        notificationService.resetNotificationState();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, [
    setTimerComplete,
    setCurrentWorkoutComplete,
    stopWorkerTimer,
    setTimeLeft,
    setIsTimerActive,
    resetNotificationFlags,
    timerComplete,
    currentWorkoutComplete,
    session,
  ]);

  // Check for timer completion from URL parameter (new window case)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("timerComplete") === "true") {
      setTimerComplete(true);
      setCurrentWorkoutComplete(true);
      // Stop the timer and set it to completed state
      stopWorkerTimer();
      setTimeLeft(0);
      setIsTimerActive(false);
      // Clean up the URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Set a flag to prevent auto-start and duplicate notifications
      sessionStorage.setItem("openedFromNotification", "true");
    }
  }, [setTimerComplete, setCurrentWorkoutComplete, stopWorkerTimer, setTimeLeft, setIsTimerActive]);

  useEffect(() => {
    if (userProfile) {
      setSettings((prevSettings) => {
        const defaultAppSettings: AppSettings = {
          notificationsEnabled: userProfile.notifications_enabled ?? true,
          darkMode: true, // Always dark mode
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

      // Check if we opened from a notification
      const openedFromNotification = sessionStorage.getItem("openedFromNotification") === "true";

      if (
        !isTimerActive &&
        (timeLeft === 0 || timeLeft !== userProfile.timer_duration) &&
        userProfile.timer_duration > 0 &&
        !openedFromNotification
      ) {
        setTimeLeft(userProfile.timer_duration);
      }
      // Don't clear the flag here - let it be cleared when actually used
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

  const refreshPendingFriendRequests = useCallback(async () => {
    const count = await fetchPendingFriendRequests();
    setPendingFriendRequests(count);
  }, []);

  const addHighFiveNotification = useCallback((senderName: string, activity: string) => {
    const id = Date.now().toString();
    setHighFiveNotifications((prev) => [...prev, { id, senderName, activity }]);
  }, []);

  const removeHighFiveNotification = useCallback((id: string) => {
    setHighFiveNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const handleStartTimer = useCallback(() => {
    if (!userProfile) return;

    // Clear any old timer notifications when starting
    try {
      notificationService.clearAllNotifications(); // Clear all notifications first
      notificationService.sendClearNotificationMessage("timer-notification");
    } catch (error) {
      console.error("App.tsx: Error clearing notifications on timer start:", error);
    }

    const duration = userProfile.timer_duration;
    // Reset timeLeft to full duration before starting to prevent immediate completion
    setTimeLeft(duration);
    startWorkerTimer(duration);
    setIsTimerActive(true);
    setTimerComplete(false);
    setCurrentWorkoutComplete(false);
    // Reset notification sent flag for new timer session
    notificationSentRef.current = false;
    console.log("App.tsx: Notification flag reset to false for new timer session");

    // Start timer sync as master
    timerSyncService.startTimerSync(duration);
  }, [
    userProfile?.timer_duration,
    startWorkerTimer,
    setIsTimerActive,
    setTimeLeft,
    setTimerComplete,
    setCurrentWorkoutComplete,
    notificationSentRef,
  ]);

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
      <RouteAwareFriendEffects
        userProfileId={userProfile?.id}
        refreshPendingFriendRequests={refreshPendingFriendRequests}
        setPendingFriendRequests={setPendingFriendRequests}
        setShowFriendRequestNotification={setShowFriendRequestNotification}
      />
      <div className="min-h-screen bg-gray-900 text-white">
        <AppNav
          userProfile={userProfile}
          sessionEmail={session?.user?.email}
          showTimerHeader={showTimerHeader}
          isTimerActive={isTimerActive}
          timeLeft={timeLeft}
          pendingFriendRequests={pendingFriendRequests}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          onSignOut={signOut}
        />

        {/* Spacer div to push content below fixed header */}
        <div className="h-16"></div>

        {/* Friend Request Notification */}
        {showFriendRequestNotification && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-3">
            <span className="text-lg">👥</span>
            <span>
              You have {pendingFriendRequests} pending friend request
              {pendingFriendRequests > 1 ? "s" : ""}!
            </span>
            <Link
              to="/friends"
              className="ml-2 text-white hover:text-gray-200 transition-colors underline">
              View
            </Link>
            <button
              onClick={() => setShowFriendRequestNotification(false)}
              className="ml-2 text-white hover:text-gray-200 transition-colors">
              ×
            </button>
          </div>
        )}

        {/* High Five Effect */}
        <HighFiveEffect
          isActive={showHighFiveEffect}
          onComplete={() => setShowHighFiveEffect(false)}
        />

        {/* High Five Notifications */}
        {highFiveNotifications.map((notification, index) => (
          <HighFiveNotification
            key={notification.id}
            senderName={notification.senderName}
            activity={notification.activity}
            onClose={() => removeHighFiveNotification(notification.id)}
            index={index}
          />
        ))}

        {settings ? (
          <Suspense fallback={<RouteLoading />}>
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
                    resetNotificationFlags={resetNotificationFlags}
                  />
                }
              />
              <Route
                path="/friends"
                element={<Friends onFriendRequestUpdate={refreshPendingFriendRequests} />}
              />
              <Route path="/activity" element={<FriendActivity />} />
              <Route path="/map" element={<ZoneMap userProfile={userProfile} />} />
              <Route path="/oura/callback" element={<OuraCallback />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
            </Routes>
          </Suspense>
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p>An error occurred or settings could not be loaded.</p>
          </div>
        )}

        <footer className="text-center p-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          <div className="mb-2">
            © {new Date().getFullYear()} Wassercise | POWER {dayOfWeek}!
          </div>
          <div className="flex justify-center space-x-4 text-xs">
            <Link
              to="/privacy-policy"
              className="text-gray-400 hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-service"
              className="text-gray-400 hover:text-gray-300 transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
