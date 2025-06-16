import { UserProfile, LeaderboardEntry, FriendActivity } from "../types/social";
import { supabase } from "./supabaseClient";

export const getUserLocation = async (): Promise<{
  city: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use reverse geocoding to get city and country
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();

          resolve({
            city: data.address.city || data.address.town || "Unknown City",
            country: data.address.country || "Unknown Country",
            coordinates: { latitude, longitude },
          });
        } catch (error) {
          reject(error);
        }
      },
      (error) => {
        reject(error);
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
        updated_at: new Date().toISOString(),
      },
      { onConflict: ["id"] }
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
