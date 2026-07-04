import { useCallback, useEffect, useRef, useState } from "react";
import { notificationService } from "../utils/notificationService";
import { timerSyncService } from "../utils/timerSyncService";

const TIMER_SOUND_PATH = "/sounds/timer-beep.mp3";

interface UseTimerNotificationsOptions {
  timerComplete: boolean;
  setTimerComplete: (value: boolean) => void;
  isTimerActive: boolean;
  timeLeft: number;
  setIsTimerActive: (value: boolean) => void;
  setCurrentWorkoutComplete: (value: boolean) => void;
}

export function useTimerNotifications({
  timerComplete,
  setTimerComplete,
  isTimerActive,
  timeLeft,
  setIsTimerActive,
  setCurrentWorkoutComplete,
}: UseTimerNotificationsOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const notificationSentRef = useRef(false);
  const [isTitleFlashing, setIsTitleFlashing] = useState(false);

  useEffect(() => {
    audioRef.current = new Audio(TIMER_SOUND_PATH);
    audioRef.current.preload = "auto";
    audioRef.current.load();
  }, []);

  const resetNotificationFlags = useCallback(() => {
    notificationSentRef.current = false;
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        new Audio(TIMER_SOUND_PATH).play().catch(() => {});
      });
      return;
    }
    new Audio(TIMER_SOUND_PATH).play().catch(() => {});
  }, []);

  const showNotification = useCallback(async (title: string, body: string) => {
    try {
      await notificationService.sendLocalNotification(title, body);
    } catch {
      if (!("Notification" in window)) return;

      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/favicon.svg",
          requireInteraction: true,
          silent: false,
          tag: "timer-notification",
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, {
              body,
              icon: "/favicon.svg",
              requireInteraction: true,
              silent: false,
              tag: "timer-notification",
            });
          }
        });
      }
    }
  }, []);

  const stopTimerNotifications = useCallback(() => {
    setIsTitleFlashing(false);
    document.body.classList.remove("timer-expired-flash");
  }, []);

  const notifyTimerExpired = useCallback(async () => {
    const openedFromNotification = sessionStorage.getItem("openedFromNotification") === "true";
    const urlParams = new URLSearchParams(window.location.search);
    const isFromNotificationUrl = urlParams.get("timerComplete") === "true";

    if (openedFromNotification || isFromNotificationUrl) {
      return;
    }

    if (!timerSyncService.isDeviceMasterSync()) {
      return;
    }

    playSound();

    try {
      await notificationService.sendTimerExpiredNotification();
    } catch {
      if (document.hidden) {
        await showNotification(
          "⏰ Timer Expired!",
          "Your workout timer has finished! Time to get movin'!"
        );
      }
    }

    setIsTitleFlashing(true);

    if (document.hidden) {
      window.focus();
    }

    document.body.classList.add("timer-expired-flash");

    setTimeout(() => {
      setIsTitleFlashing(false);
      document.body.classList.remove("timer-expired-flash");
    }, 10000);
  }, [playSound, showNotification]);

  useEffect(() => {
    let interactionTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleUserInteraction = () => {
      if (isTitleFlashing) {
        stopTimerNotifications();
      }

      if (isTimerActive && !timerSyncService.isDeviceMasterSync()) {
        if (interactionTimeout) {
          clearTimeout(interactionTimeout);
        }
        interactionTimeout = setTimeout(() => {
          timerSyncService.becomeMaster();
        }, 100);
      }
    };

    document.addEventListener("click", handleUserInteraction);
    document.addEventListener("keydown", handleUserInteraction);
    document.addEventListener("touchstart", handleUserInteraction);
    document.addEventListener("scroll", handleUserInteraction);

    return () => {
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
      }
      document.removeEventListener("click", handleUserInteraction);
      document.removeEventListener("keydown", handleUserInteraction);
      document.removeEventListener("touchstart", handleUserInteraction);
      document.removeEventListener("scroll", handleUserInteraction);
    };
  }, [isTitleFlashing, stopTimerNotifications, isTimerActive]);

  useEffect(() => {
    if (!isTitleFlashing) {
      document.title = "Dicey Movements";
      return;
    }

    const interval = setInterval(() => {
      document.title =
        document.title === "⏰ TIMER EXPIRED! ⏰" ? "Dicey Movements" : "⏰ TIMER EXPIRED! ⏰";
    }, 1000);

    return () => {
      clearInterval(interval);
      document.title = "Dicey Movements";
    };
  }, [isTitleFlashing]);

  useEffect(() => {
    if (timeLeft === 0 && isTimerActive && !timerComplete) {
      setTimerComplete(true);
      setIsTimerActive(false);
      setCurrentWorkoutComplete(false);
      notificationSentRef.current = false;
    }
  }, [timeLeft, isTimerActive, timerComplete, setTimerComplete, setIsTimerActive, setCurrentWorkoutComplete]);

  useEffect(() => {
    if (!timerComplete || notificationSentRef.current) {
      return;
    }

    if (sessionStorage.getItem("openedFromNotification") === "true") {
      sessionStorage.removeItem("openedFromNotification");
      notificationSentRef.current = true;
      return;
    }

    notificationSentRef.current = true;
    notifyTimerExpired();
  }, [timerComplete, notifyTimerExpired]);

  return {
    isTitleFlashing,
    notificationSentRef,
    resetNotificationFlags,
    stopTimerNotifications,
  };
}
