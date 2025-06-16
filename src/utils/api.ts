import { UserProfile, LeaderboardEntry, FriendActivity } from "../types/social";

const API_URL = process.env.VITE_API_URL || "http://localhost:3001/api";

export const fetchLeaderboard = async (location: string): Promise<LeaderboardEntry[]> => {
  const response = await fetch(`${API_URL}/leaderboard/${encodeURIComponent(location)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard");
  }
  return response.json();
};

export const fetchUserProfile = async (userId: string): Promise<UserProfile> => {
  const response = await fetch(`${API_URL}/profile/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }
  return response.json();
};

export const fetchFriendActivities = async (userId: string): Promise<FriendActivity[]> => {
  const response = await fetch(`${API_URL}/friends/activity/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch friend activities");
  }
  return response.json();
};
