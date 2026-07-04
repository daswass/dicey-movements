import { api } from "./api";
import { getAuthUserId, requireAuthUserId } from "./authSession";
import { supabase } from "./supabaseClient";

export const getUserLocation = async (options?: {
  /** When true, bypass cached position and request a new GPS fix. */
  fresh?: boolean;
}): Promise<{
  city: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
  timezone: string;
}> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        city: "Unknown City",
        country: "Unknown Country",
        coordinates: { latitude: 0, longitude: 0 },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      resolve({
        city: "Unknown City",
        country: "Unknown Country",
        coordinates: { latitude: 0, longitude: 0 },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        clearTimeout(timeoutId);
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&timeout=5000`
          );

          if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.status}`);
          }

          const data = await response.json();

          resolve({
            city:
              data.address?.city || data.address?.town || data.address?.village || "Unknown City",
            country: data.address?.country || "Unknown Country",
            coordinates: { latitude, longitude },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        } catch (error) {
          console.warn("Error getting location details:", error);
          resolve({
            city: "Unknown City",
            country: "Unknown Country",
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          });
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        console.warn("Geolocation error:", error);
        resolve({
          city: "Unknown City",
          country: "Unknown Country",
          coordinates: { latitude: 0, longitude: 0 },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
      },
      {
        enableHighAccuracy: options?.fresh ?? false,
        timeout: options?.fresh ? 10000 : 8000,
        maximumAge: options?.fresh ? 0 : 300000,
      }
    );
  });
};

export const updateUserLocation = async (): Promise<import("../types/social").UserProfile> => {
  const userId = await requireAuthUserId();

  const location = await getUserLocation();
  const { data, error } = await supabase
    .from("profiles")
    .update({ location })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchPendingFriendRequests = async (): Promise<number> => {
  try {
    const userId = getAuthUserId();
    if (!userId) return 0;

    const { data, error } = await supabase
      .from("friends")
      .select("id")
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("Error fetching pending friend requests:", error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error("Error in fetchPendingFriendRequests:", error);
    return 0;
  }
};

export const sendHighFive = async (toUserId: string, activity?: string): Promise<boolean> => {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      console.error("sendHighFive: User not authenticated");
      return false;
    }

    const response = await api.fetch("/api/high-five/send", {
      method: "POST",
      body: JSON.stringify({
        fromUserId: userId,
        toUserId,
        activity,
      }),
    });

    return response.success === true;
  } catch (error) {
    console.error("sendHighFive: Error sending high five:", error);
    return false;
  }
};
