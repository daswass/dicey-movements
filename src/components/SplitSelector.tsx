import React from "react";
import { splits } from "../data/exercises";

interface SplitSelectorProps {
  selectedSplitId: string;
  onSplitChange: (splitId: string) => void;
  className?: string;
}

const SplitSelector: React.FC<SplitSelectorProps> = ({
  selectedSplitId,
  onSplitChange,
  className = "",
}) => {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3">
        {splits.map((split) => (
          <button
            key={split.id}
            onClick={() => onSplitChange(split.id)}
            className={`p-3 rounded-lg border-2 transition-all ${
              selectedSplitId === split.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300"
            }`}>
            <div className="text-center">
              <div className="text-2xl mb-1">{split.emoji}</div>
              <div className="font-medium text-sm">{split.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {split.exercises.length} exercises
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Selected:{" "}
        <span className="font-medium">{splits.find((s) => s.id === selectedSplitId)?.name}</span>
      </div>
    </div>
  );
};

export default SplitSelector;
