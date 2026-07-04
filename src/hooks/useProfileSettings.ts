import { useCallback, useEffect, useState } from "react";
import { getSplitById } from "../data/exercises";
import { UserProfile } from "../types/social";
import { notificationService } from "../utils/notificationService";
import { supabase } from "../utils/supabaseClient";

interface UseProfileSettingsOptions {
  userId: string | undefined;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  onResetTimerToDuration: (duration: number) => void;
}

export function useProfileSettings({
  userId,
  userProfile,
  setUserProfile,
  onResetTimerToDuration,
}: UseProfileSettingsOptions) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    userProfile?.notifications_enabled ?? true
  );

  useEffect(() => {
    if (userProfile?.notifications_enabled !== undefined) {
      setNotificationsEnabled(userProfile.notifications_enabled);
    }
  }, [userProfile?.notifications_enabled]);

  const updateNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      setNotificationsEnabled(enabled);
      if (!userId) return;

      const { error } = await supabase
        .from("profiles")
        .update({ notifications_enabled: enabled })
        .eq("id", userId);

      if (error) {
        console.error("useProfileSettings: Error updating notifications_enabled:", error);
      } else {
        setUserProfile((prev) => (prev ? { ...prev, notifications_enabled: enabled } : null));
      }
    },
    [userId, setUserProfile]
  );

  const updateTimerDuration = useCallback(
    async (newDuration: number) => {
      setUserProfile((prev) => (prev ? { ...prev, timer_duration: newDuration } : null));
      onResetTimerToDuration(newDuration);

      try {
        notificationService.clearAllNotifications();
        await notificationService.sendClearNotificationMessage("timer-notification");
      } catch (error) {
        console.error("useProfileSettings: Error clearing notifications:", error);
      }

      if (!userId) return;

      const { error } = await supabase
        .from("profiles")
        .update({ timer_duration: newDuration })
        .eq("id", userId);

      if (error) {
        console.error("useProfileSettings: Error updating timer_duration:", error);
      }
    },
    [userId, onResetTimerToDuration, setUserProfile]
  );

  const handleSplitChange = useCallback(
    async (newSplitId: string) => {
      const newSplit = getSplitById(newSplitId);
      setUserProfile((prev) => (prev ? { ...prev, user_split_id: newSplitId } : null));

      if (!userId) return;

      const { error } = await supabase
        .from("profiles")
        .update({ user_split_id: newSplitId })
        .eq("id", userId);

      if (error) {
        console.error("useProfileSettings: Error updating user split:", error);
      }

      return newSplit;
    },
    [userId, setUserProfile]
  );

  return {
    notificationsEnabled,
    updateNotificationsEnabled,
    updateTimerDuration,
    handleSplitChange,
  };
}
