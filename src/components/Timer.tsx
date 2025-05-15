import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimerProps {
  duration: number;
  onComplete: () => void;
  resetSignal?: boolean;
}

const Timer: React.FC<TimerProps> = ({ duration, onComplete, resetSignal }) => {
  const [timeLeft, setTimeLeft] = useState<number>(duration);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const intervalRef = useRef<number | null>(null);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progressPercentage = (timeLeft / duration) * 100;
  
  useEffect(() => {
    if (resetSignal) {
      resetTimer();
      setIsActive(true);
    }
  }, [resetSignal]);
  
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !isCompleted) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsActive(false);
      setIsCompleted(true);
      onComplete();
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, timeLeft, isCompleted, onComplete]);
  
  const toggleTimer = () => {
    setIsActive(prev => !prev);
  };
  
  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsActive(false);
    setTimeLeft(duration);
    setIsCompleted(false);
  };

  const getColorClass = () => {
    if (progressPercentage > 66) return 'text-green-500 dark:text-green-400';
    if (progressPercentage > 33) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-red-500 dark:text-red-400';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48 mb-6">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isCompleted ? "#10B981" : "#E5E7EB"}
            strokeWidth="8"
            className="dark:stroke-gray-700"
          />
          
          {!isCompleted && (
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={progressPercentage > 66 ? "#10B981" : progressPercentage > 33 ? "#F59E0B" : "#EF4444"}
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
          <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isActive ? "Running" : isCompleted ? "Completed" : "Paused"}
          </span>
        </div>
      </div>
      
      <div className="flex space-x-4">
        <button
          onClick={toggleTimer}
          disabled={isCompleted}
          className={`p-3 rounded-full ${
            isCompleted 
              ? "bg-gray-200 text-gray-400 dark:bg-gray-700 cursor-not-allowed" 
              : isActive 
                ? "bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30" 
                : "bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
          } transition-colors`}
        >
          {isActive ? <Pause size={24} /> : <Play size={24} />}
        </button>
        
        <button
          onClick={resetTimer}
          className="p-3 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
        >
          <RotateCcw size={24} />
        </button>
      </div>
    </div>
  );
};

export default Timer;