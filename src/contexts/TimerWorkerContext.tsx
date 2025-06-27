import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface TimerWorkerContextType {
  isTimerActive: boolean;
  setIsTimerActive: React.Dispatch<React.SetStateAction<boolean>>;
  timeLeft: number;
  setTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  startTimer: (durationSeconds: number) => void;
  stopTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimerToDuration: (newDuration: number) => void;
}

const TimerWorkerContext = createContext<TimerWorkerContextType | undefined>(undefined);

export const TimerWorkerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const workerRef = useRef<Worker | null>(null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const isPausingRef = useRef(false); // Track if we're currently pausing

  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/timer.worker.ts", import.meta.url));
      console.log("Timer Worker initialized in context.");

      workerRef.current.onmessage = (event) => {
        const { type, timeLeft: workerTimeLeft } = event.data;

        /*
        console.log(
          `[Context Worker Message] Type: ${type}, Worker TimeLeft: ${workerTimeLeft}, Current Context TimeLeft: ${timeLeft}`
        );
        */

        if (type === "TICK") {
          setTimeLeft(workerTimeLeft);
          // Only set isTimerActive to true if we're not currently pausing
          if (!isPausingRef.current) {
            setIsTimerActive(true);
          }
        } else if (type === "COMPLETE") {
          setTimeLeft(0);
          setIsTimerActive(false);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error("Timer Worker error:", error);
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: "STOP" });
        workerRef.current.terminate();
        workerRef.current = null;
        console.log("Timer Worker cleaned up and terminated in context.");
      }
    };
  }, []);

  const startTimer = useCallback((durationSeconds: number) => {
    if (workerRef.current) {
      console.log(
        `[Context Action] Sending START to worker with duration: ${durationSeconds} seconds`
      );
      workerRef.current.postMessage({ type: "START", duration: durationSeconds });
      setIsTimerActive(true);
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (workerRef.current) {
      console.log("[Context Action] Sending STOP to worker (no timeLeft reset here)");
      workerRef.current.postMessage({ type: "STOP" });
      setIsTimerActive(false);
    }
  }, []);

  const pauseTimer = useCallback(() => {
    if (workerRef.current) {
      console.log("[Context Action] Sending PAUSE to worker");
      isPausingRef.current = true; // Set flag before sending pause
      workerRef.current.postMessage({ type: "PAUSE" });
      setIsTimerActive(false);
      // Reset the flag after a short delay to allow the worker to send the TICK message
      setTimeout(() => {
        isPausingRef.current = false;
      }, 100);
    }
  }, []);

  const resumeTimer = useCallback(() => {
    if (workerRef.current) {
      console.log("[Context Action] Sending RESUME to worker");
      workerRef.current.postMessage({ type: "RESUME" });
      setIsTimerActive(true);
      isPausingRef.current = false; // Reset flag when resuming
    }
  }, []);

  const resetTimerToDuration = useCallback((newDuration: number) => {
    if (workerRef.current) {
      console.log(`[Context Action] Explicitly resetting timer to ${newDuration} seconds.`);
      workerRef.current.postMessage({ type: "STOP" }); // Ensure worker stops any active timer
      setTimeLeft(newDuration); // Explicitly set timeLeft in context
      setIsTimerActive(false);
    }
  }, []);

  const contextValue = React.useMemo(
    () => ({
      isTimerActive,
      setIsTimerActive,
      timeLeft,
      setTimeLeft,
      startTimer,
      stopTimer,
      pauseTimer,
      resumeTimer,
      resetTimerToDuration,
    }),
    [isTimerActive, timeLeft, startTimer, stopTimer, pauseTimer, resumeTimer, resetTimerToDuration]
  );

  return <TimerWorkerContext.Provider value={contextValue}>{children}</TimerWorkerContext.Provider>;
};

export const useTimerWorker = () => {
  const context = useContext(TimerWorkerContext);
  if (context === undefined) {
    throw new Error("useTimerWorker must be used within a TimerWorkerProvider");
  }
  return context;
};
