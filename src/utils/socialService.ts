import { UserProfile, LeaderboardEntry, FriendActivity } from "../types/social";
import { supabase } from "./supabaseClient";
import { api } from "./api";

export const getUserLocation = async (): Promise<{
  city: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
  timezone: string;
}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      // Provide fallback location if geolocation is not supported
      resolve({
        city: "Unknown City",
        country: "Unknown Country",
        coordinates: { latitude: 0, longitude: 0 },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      });
      return;
    }

    const timeoutId = setTimeout(() => {
      // Timeout fallback after 10 seconds
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
          // Use reverse geocoding to get city and country
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
          // Still resolve with coordinates even if geocoding fails
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
        // Provide fallback location on geolocation error
        resolve({
          city: "Unknown City",
          country: "Unknown Country",
          coordinates: { latitude: 0, longitude: 0 },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
};

export const fetchLeaderboard = async (location: string): Promise<LeaderboardEntry[]> => {
  // TODO: Implement API call to fetch leaderboard data
  // This is a mock implementation
  return [
    {
      userId: "1",
      username: "JohnDoe",
      score: 150,
      location: "New York",
      timestamp: new Date(),
    },
    {
      userId: "2",
      username: "JaneSmith",
      score: 120,
      location: "New York",
      timestamp: new Date(),
    },
  ];
};

export const fetchFriendActivities = async (userId: string): Promise<FriendActivity[]> => {
  // TODO: Implement API call to fetch friend activities
  // This is a mock implementation
  return [
    {
      userId: "1",
      username: "JohnDoe",
      activity: {
        type: "workout",
        details: "Completed 50 push-ups",
        timestamp: new Date(),
      },
    },
  ];
};

export const updateUserProfile = async (profile: Partial<UserProfile>): Promise<UserProfile> => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        ...profile,
      },
      { onConflict: "id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as UserProfile;
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error) return null;
  return data as UserProfile;
};

export const updateUserLocation = async (): Promise<UserProfile> => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const location = await getUserLocation();
  const { data, error } = await supabase
    .from("profiles")
    .update({ location })
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
};

export const fetchPendingFriendRequests = async (): Promise<number> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from("friends")
      .select("id")
      .eq("friend_id", user.id)
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

export const sendFriendActivityNotification = async (
  friendUserId: string,
  activity: string
): Promise<void> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Get friend's name
    const { data: friendProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", friendUserId)
      .single();

    if (!friendProfile) return;

    const friendName = `${friendProfile.first_name} ${friendProfile.last_name}`;

    // Send notification to all friends of the user who completed the activity
    const { data: friends } = await supabase
      .from("friends")
      .select("user_id")
      .eq("friend_id", friendUserId)
      .eq("status", "accepted");

    if (!friends) return;

    // Send notifications to all friends
    for (const friend of friends) {
      try {
        await api.fetch("/api/push/send", {
          method: "POST",
          body: JSON.stringify({
            userId: friend.user_id,
            payload: {
              type: "friend_activity",
              friendName,
              activity,
            },
          }),
        });
      } catch (error) {
        console.error("Error sending friend activity notification:", error);
      }
    }
  } catch (error) {
    console.error("Error sending friend activity notification:", error);
  }
};
