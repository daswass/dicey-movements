import { useEffect } from "react";
import { timerSyncService } from "../utils/timerSyncService";

interface UseTimerSyncOptions {
  timerComplete: boolean;
  setTimerComplete: (value: boolean) => void;
  isTimerActive: boolean;
  setIsTimerActive: (value: boolean) => void;
  setTimeLeft: (value: number) => void;
  setCurrentWorkoutComplete: (value: boolean) => void;
  startWorkerTimer: (durationSeconds: number) => void;
  stopWorkerTimer: () => void;
}

export function useTimerSync({
  timerComplete,
  setTimerComplete,
  isTimerActive,
  setIsTimerActive,
  setTimeLeft,
  setCurrentWorkoutComplete,
  startWorkerTimer,
  stopWorkerTimer,
}: UseTimerSyncOptions) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(() => {
          timerSyncService.refreshState();
        }, 1000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleTimerStateChange = (state: {
      startTime: string | null;
      masterDeviceId: string | null;
      duration: number;
    }) => {
      if (state.startTime && state.masterDeviceId && !isTimerActive && state.duration > 0) {
        const startTime = new Date(state.startTime);
        const elapsedMs = Date.now() - startTime.getTime();
        const remainingMs = Math.max(0, state.duration * 1000 - elapsedMs);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        if (remainingSeconds > 0) {
          setTimeLeft(remainingSeconds);
          setIsTimerActive(true);
          setTimerComplete(false);
          setCurrentWorkoutComplete(false);
          startWorkerTimer(remainingSeconds);
        } else if (!timerComplete) {
          setTimerComplete(true);
          setIsTimerActive(false);
          setTimeLeft(0);
          setCurrentWorkoutComplete(false);
          stopWorkerTimer();
        }
      } else if (!state.startTime && state.duration > 0 && timerSyncService.isDeviceMasterSync()) {
        if (isTimerActive) {
          setIsTimerActive(false);
          setTimeLeft(0);
          stopWorkerTimer();
        }
      }
    };

    timerSyncService.startPolling(handleTimerStateChange);

    return () => {
      timerSyncService.stopPolling();
    };
  }, [
    timerComplete,
    isTimerActive,
    setTimerComplete,
    setIsTimerActive,
    setTimeLeft,
    setCurrentWorkoutComplete,
    stopWorkerTimer,
    startWorkerTimer,
  ]);

  useEffect(() => {
    return () => {
      if (timerSyncService.isDeviceMasterSync()) {
        timerSyncService.stopTimerSync();
      }
      timerSyncService.stopPolling();
    };
  }, []);
}
