import React, { useEffect, useRef } from "react";

interface TimerHeaderProps {
  duration: number;
  onComplete: () => void;
  resetSignal: boolean;
  isActive: boolean;
  timeLeft: number;
  setTimeLeft: (time: number) => void;
}

const TimerHeader: React.FC<TimerHeaderProps> = ({
  duration,
  onComplete,
  resetSignal,
  isActive,
  timeLeft,
  setTimeLeft,
}) => {
  const timerWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize timer worker
    timerWorkerRef.current = new Worker(new URL("../workers/timer.worker.ts", import.meta.url));

    // Handle worker messages
    timerWorkerRef.current.onmessage = (e) => {
      const { type, timeLeft: newTimeLeft } = e.data;

      switch (type) {
        case "TICK":
          setTimeLeft(newTimeLeft);
          break;
        case "COMPLETE":
          setTimeLeft(0);
          onComplete();
          break;
      }
    };

    return () => {
      timerWorkerRef.current?.terminate();
    };
  }, [onComplete, setTimeLeft]);

  useEffect(() => {
    if (resetSignal) {
      setTimeLeft(duration);
      timerWorkerRef.current?.postMessage({ type: "STOP" });
    }
  }, [resetSignal, duration, setTimeLeft]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerWorkerRef.current?.postMessage({ type: "START", duration: timeLeft });
    } else {
      timerWorkerRef.current?.postMessage({ type: "STOP" });
    }
  }, [isActive, timeLeft]);

  return (
    <div className="flex items-center space-x-2">
      {isActive && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
      <span className="text-sm font-medium">
        ({Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")})
      </span>
    </div>
  );
};

export default TimerHeader;
