import { lazy, Suspense } from "react";
import { Exercise } from "../types";
import { UserProfile } from "../types/social";
import { AchievementNotification } from "./AchievementNotification";
import SettingsPanel from "./SettingsPanel";
import { WorkoutCompleteHeistInfo, WorkoutCompleteModal } from "./WorkoutCompleteModal";

const ExerciseInstructionsModal = lazy(() => import("./ExerciseInstructionsModal"));

interface DashboardModalsProps {
  showSettings: boolean;
  onCloseSettings: () => void;
  userProfile: UserProfile;
  timerDuration: number | undefined;
  updateTimerDuration: (duration: number) => void;
  notificationsEnabled: boolean;
  updateNotificationsEnabled: (enabled: boolean) => void;
  onUserProfileUpdate: (profile: UserProfile) => void;
  workoutCompleteModal: { heist?: WorkoutCompleteHeistInfo } | null;
  showConfirmModal: boolean;
  confirmModalType: "game" | "multipliers" | null;
  onConfirmReset: () => void;
  onCancelReset: () => void;
  unlockedAchievements: string[];
  onDismissAchievement: (achievementId: string) => void;
  showExerciseModal: boolean;
  selectedExercise: Exercise | null;
  onCloseExerciseModal: () => void;
}

export default function DashboardModals({
  showSettings,
  onCloseSettings,
  userProfile,
  timerDuration,
  updateTimerDuration,
  notificationsEnabled,
  updateNotificationsEnabled,
  onUserProfileUpdate,
  workoutCompleteModal,
  showConfirmModal,
  confirmModalType,
  onConfirmReset,
  onCancelReset,
  unlockedAchievements,
  onDismissAchievement,
  showExerciseModal,
  selectedExercise,
  onCloseExerciseModal,
}: DashboardModalsProps) {
  return (
    <>
      {unlockedAchievements.map((achievementId, index) => (
        <AchievementNotification
          key={`${achievementId}-${index}`}
          achievementId={achievementId}
          index={index}
          onClose={() => onDismissAchievement(achievementId)}
        />
      ))}

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={onCloseSettings}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
              &times;
            </button>
            <SettingsPanel
              timerDuration={timerDuration}
              updateTimerDuration={updateTimerDuration}
              notificationsEnabled={notificationsEnabled}
              updateNotificationsEnabled={updateNotificationsEnabled}
              userProfile={userProfile}
              onClose={onCloseSettings}
              onUserProfileUpdate={onUserProfileUpdate}
            />
          </div>
        </div>
      )}

      {workoutCompleteModal && <WorkoutCompleteModal heist={workoutCompleteModal.heist} />}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Reset Day?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {confirmModalType === "game"
                ? "This will reset today's game progress, including multipliers and history."
                : "This will reset all exercise multipliers to 1x."}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={onCancelReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                Cancel
              </button>
              <button
                onClick={onConfirmReset}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && (
        <Suspense fallback={null}>
          <ExerciseInstructionsModal
            exercise={selectedExercise}
            isOpen={showExerciseModal}
            onClose={onCloseExerciseModal}
          />
        </Suspense>
      )}
    </>
  );
}
