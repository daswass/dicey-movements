import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";

interface TimerProps {
  duration: number;
  onComplete: () => void;
  resetSignal: boolean;
  isActive: boolean;
  setIsActive: (active: boolean) => void;
  timeLeft: number;
  setTimeLeft: (time: number) => void;
}

const Timer: React.FC<TimerProps> = ({
  duration,
  onComplete,
  resetSignal,
  isActive,
  setIsActive,
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPercentage = (timeLeft / duration) * 100;

  const getColorClass = () => {
    if (progressPercentage > 66) return "text-green-500 dark:text-green-400";
    if (progressPercentage > 33) return "text-yellow-500 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
  };

  const handleStart = () => setIsActive(true);
  const handlePause = () => setIsActive(false);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={timeLeft === 0 ? "#10B981" : "#E5E7EB"}
            strokeWidth="8"
            className="dark:stroke-gray-700"
          />

          {timeLeft > 0 && (
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={
                progressPercentage > 66
                  ? "#10B981"
                  : progressPercentage > 33
                  ? "#F59E0B"
                  : "#EF4444"
              }
              strokeWidth="8"
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * progressPercentage) / 100}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className="transition-all duration-1000"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-bold ${getColorClass()}`}>
            {timeLeft === 0 ? "Done!" : formatTime(timeLeft)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isActive ? "Running" : timeLeft === 0 ? "Completed" : "Paused"}
          </span>
        </div>
      </div>
      <div className="flex space-x-4 mt-4">
        {!isActive && timeLeft > 0 && (
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            Start
          </button>
        )}
        {isActive && timeLeft > 0 && (
          <button
            onClick={handlePause}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
            Pause
          </button>
        )}
      </div>
    </div>
  );
};

export default Timer;
