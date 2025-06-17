import React, { useEffect } from "react";
import { useTimerWorker } from "../contexts/TimerWorkerContext";

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
  const { worker } = useTimerWorker();

  useEffect(() => {
    if (!worker) return;

    // Handle worker messages
    worker.onmessage = (e) => {
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
  }, [worker, onComplete, setTimeLeft]);

  useEffect(() => {
    if (!worker) return;

    if (resetSignal) {
      setTimeLeft(duration);
      worker.postMessage({ type: "STOP" });
    }
  }, [resetSignal, duration, setTimeLeft, worker]);

  useEffect(() => {
    if (!worker) return;

    if (isActive && timeLeft > 0) {
      worker.postMessage({ type: "START", duration: timeLeft });
    } else {
      worker.postMessage({ type: "STOP" });
    }
  }, [isActive, timeLeft, worker]);

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
