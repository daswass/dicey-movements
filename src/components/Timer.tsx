import React, { useCallback, useEffect, useState } from "react";
import { useTimerWorker } from "../contexts/TimerWorkerContext";
import { notificationService } from "../utils/notificationService";
import { api } from "../utils/api";

interface TimerProps {
  duration: number; // The initial total duration for progress calculation (from user profile)
  onComplete: () => void; // Callback to Dashboard when timer visually completes
  onRollAndStart?: () => void; // New callback for Roll & Start functionality
}

const Timer: React.FC<TimerProps> = ({
  duration, // This is the original duration for the progress bar.
  onComplete,
  onRollAndStart,
}) => {
  // Destructure state and control functions directly from the context
  const { isTimerActive, timeLeft, startTimer, stopTimer, pauseTimer, resumeTimer } =
    useTimerWorker();

  // Track if health check has been performed
  const [healthCheckPerformed, setHealthCheckPerformed] = useState(false);

  // Initial progress percentage state
  // Start with 100% visually if timeLeft is equal to duration (ready state)
  const [progressPercentage, setProgressPercentage] = useState<number>(() => {
    if (duration <= 0) return 0;
    if (!isTimerActive && timeLeft === duration) return 100;
    return (timeLeft / duration) * 100;
  });

  // Health check function
  const performHealthCheck = useCallback(async () => {
    try {
      const isHealthy = await api.healthCheck();
      if (isHealthy) {
        setHealthCheckPerformed(true);
      } else {
        console.warn("Timer: Health check failed - backend may be hibernated");
      }
    } catch (error) {
      console.warn("Timer: Health check failed:", error);
    }
  }, []);

  // Effect to perform health check when 1 minute left
  useEffect(() => {
    if (isTimerActive && timeLeft === 60 && !healthCheckPerformed) {
      performHealthCheck();
    }
  }, [isTimerActive, timeLeft, healthCheckPerformed, performHealthCheck]);

  // Effect to update progress percentage
  useEffect(() => {
    if (duration <= 0) {
      setProgressPercentage(0);
      return;
    }

    // If timer is not active AND timeLeft is exactly the duration, it means it's ready to start.
    // In this state, the progress should visually be 100%.
    if (!isTimerActive && timeLeft === duration) {
      setProgressPercentage(100);
    } else {
      // For all other states (running, paused, completed, or starting from non-full time), calculate
      const newProgress = (timeLeft / duration) * 100;
      setProgressPercentage(newProgress);
    }
  }, [timeLeft, duration, isTimerActive]); // Depends on these states

  // Handle timer completion (visual only, context manages actual state)
  useEffect(() => {
    // Trigger onComplete when timeLeft is 0 AND timer is not active AND duration was greater than 0
    if (timeLeft === 0 && !isTimerActive && duration > 0) {
      onComplete(); // Notify the parent component (Dashboard)
    }
  }, [timeLeft, isTimerActive, onComplete, duration]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const getColorClass = useCallback(() => {
    if (progressPercentage > 66) return "text-green-500 dark:text-green-400";
    if (progressPercentage > 33) return "text-yellow-500 dark:text-yellow-400";
    return "text-red-500 dark:text-red-400";
  }, [progressPercentage]);

  // Improved notification clearing with better error handling
  const clearNotificationsSafely = useCallback(async () => {
    try {
      await notificationService.clearAllNotifications();
      await notificationService.sendClearNotificationMessage("timer-notification");
    } catch (error) {
      console.warn(
        "Timer: Failed to clear notifications (this is normal if backend is hibernated):",
        error
      );
      // Don't throw - this is not critical for timer functionality
    }
  }, []);

  const handleStart = useCallback(() => {
    console.log("Timer component - Start button clicked. Starting duration:", duration);

    // Reset health check flag when starting new timer
    setHealthCheckPerformed(false);

    // Clear any old timer notifications when starting
    clearNotificationsSafely();

    startTimer(duration); // Start with the full duration from props
  }, [startTimer, duration, clearNotificationsSafely]);

  const handleRollAndStart = useCallback(() => {
    console.log("Timer component - Roll & Start button clicked.");
    if (onRollAndStart) {
      onRollAndStart();
    }
  }, [onRollAndStart]);

  const handlePause = useCallback(() => {
    console.log("Timer component - Pause button clicked.");
    pauseTimer();

    // Clear timer notifications when pausing
    clearNotificationsSafely();
  }, [pauseTimer, clearNotificationsSafely]);

  const handleResume = useCallback(() => {
    console.log("Timer component - Resume button clicked.");
    resumeTimer();

    // Clear any lingering timer notifications when resuming
    clearNotificationsSafely();
  }, [resumeTimer, clearNotificationsSafely]);

  // Redefine the state flags for accurate button display logic
  const isReadyToStart = !isTimerActive && timeLeft === duration && duration > 0; // At full duration, not active, and a valid duration is set
  const isRunning = isTimerActive && timeLeft > 0; // Timer is active and has time left
  const isPaused = !isTimerActive && timeLeft > 0 && timeLeft < duration; // Not active, but time left is between 0 and full duration
  const isCompleted = timeLeft === 0 && !isTimerActive && duration > 0; // Timer finished naturally

  // Determine what text to show for the status
  const statusText = isRunning
    ? "Running"
    : isPaused
    ? "Paused"
    : isCompleted
    ? "Completed"
    : "Ready";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isCompleted ? "#10B981" : "#E5E7EB"} // Green when complete, otherwise light gray
            strokeWidth="8"
            className="dark:stroke-gray-700"
          />

          {/* Show progress circle if time is left OR if it's the initial/ready state (full circle) */}
          {/* This condition now relies on isReadyToStart to ensure a full circle is drawn when ready */}
          {(timeLeft > 0 || isReadyToStart) && (
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={
                progressPercentage > 66
                  ? "#10B981" // Green
                  : progressPercentage > 33
                  ? "#F59E0B" // Yellow
                  : "#EF4444" // Red
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
            {isCompleted ? "Done!" : formatTime(timeLeft)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">{statusText}</span>
        </div>
      </div>
      <div className="flex space-x-4 mt-4">
        {/* Start Button: Only if ready to start a new cycle */}
        {isReadyToStart && (
          <>
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Start
            </button>
            {onRollAndStart && (
              <button
                onClick={handleRollAndStart}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">
                Roll & Start
              </button>
            )}
          </>
        )}

        {/* Pause Button: Only if currently running */}
        {isRunning && (
          <button
            onClick={handlePause}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
            Pause
          </button>
        )}

        {/* Resume Button: Only if paused */}
        {isPaused && (
          <button
            onClick={handleResume}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Resume
          </button>
        )}
      </div>
    </div>
  );
};

export default Timer;
