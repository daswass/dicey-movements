import { useEffect } from "react";
import { resolveSyncTimerAction } from "../utils/timerSyncLogic";
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
      const action = resolveSyncTimerAction({
        state,
        isTimerActive,
        timerComplete,
        isMaster: timerSyncService.isDeviceMasterSync(),
      });

      switch (action.type) {
        case "resume":
          setTimeLeft(action.remainingSeconds);
          setIsTimerActive(true);
          setTimerComplete(false);
          setCurrentWorkoutComplete(false);
          startWorkerTimer(action.remainingSeconds);
          break;
        case "complete":
          setTimerComplete(true);
          setIsTimerActive(false);
          setTimeLeft(0);
          setCurrentWorkoutComplete(false);
          stopWorkerTimer();
          break;
        case "clear":
          setIsTimerActive(false);
          setTimeLeft(0);
          stopWorkerTimer();
          break;
        case "noop":
          break;
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
