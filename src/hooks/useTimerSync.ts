import { useEffect, useState } from "react";
import { resolveSyncTimerAction } from "../utils/timerSyncLogic";
import { timerSyncService } from "../utils/timerSyncService";

interface UseTimerSyncOptions {
  userId: string | undefined;
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
  userId,
  timerComplete,
  setTimerComplete,
  isTimerActive,
  setIsTimerActive,
  setTimeLeft,
  setCurrentWorkoutComplete,
  startWorkerTimer,
  stopWorkerTimer,
}: UseTimerSyncOptions) {
  const [timerHydrated, setTimerHydrated] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void timerSyncService.refreshState();
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

    let cancelled = false;
    setTimerHydrated(false);

    if (!userId) {
      setTimerHydrated(true);
      return;
    }

    void timerSyncService.startPolling(handleTimerStateChange).finally(() => {
      if (!cancelled) {
        setTimerHydrated(true);
      }
    });

    return () => {
      cancelled = true;
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
    userId,
  ]);

  useEffect(() => {
    return () => {
      if (timerSyncService.isDeviceMasterSync()) {
        timerSyncService.stopTimerSync();
      }
      timerSyncService.stopPolling();
    };
  }, []);

  return { timerHydrated };
}
