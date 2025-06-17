import React, { createContext, useContext, useEffect, useRef } from "react";

interface TimerWorkerContextType {
  worker: Worker | null;
}

const TimerWorkerContext = createContext<TimerWorkerContextType | null>(null);

export const TimerWorkerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Create the worker only once
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("../workers/timer.worker.ts", import.meta.url));
    }

    return () => {
      // Clean up the worker when the provider is unmounted
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return (
    <TimerWorkerContext.Provider value={{ worker: workerRef.current }}>
      {children}
    </TimerWorkerContext.Provider>
  );
};

export const useTimerWorker = () => {
  const context = useContext(TimerWorkerContext);
  if (!context) {
    throw new Error("useTimerWorker must be used within a TimerWorkerProvider");
  }
  return context;
};
