import React from "react";

interface TimerHeaderProps {
  isActive: boolean;
  timeLeft: number;
}

const TimerHeader: React.FC<TimerHeaderProps> = ({ isActive, timeLeft }) => {
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
