import React, { useState, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
}

export const Friends: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");

  // Fetch friends list
  const fetchFriends = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("friends")
        .select(
          `
          *,
          friend:friend_id (
            first_name,
            last_name,
            username
          )
        `
        )
        .eq("user_id", user.id)
        .eq("status", "accepted");

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData =
        data?.map((friend) => ({
          ...friend,
          profiles: friend.friend || null,
        })) || [];

      setFriends(transformedData);
    } catch (err) {
      console.error("Error fetching friends:", err);
      setError("Failed to load friends");
    }
  };

  // Search for users
  const searchUsers = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,username.ilike.%${term}%`)
        .neq("id", user.id);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error searching users:", err);
      setError("Failed to search users");
    } finally {
      setLoading(false);
    }
  };

  // Send friend request
  const sendFriendRequest = async (friendId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: friendId,
        status: "pending",
      });

      if (error) throw error;
      setSearchResults((prev) => prev.filter((u) => u.id !== friendId));
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError("Failed to send friend request");
    }
  };

  // Remove friend
  const removeFriend = async (friendId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
        );

      if (error) throw error;
      setFriends((prev) => prev.filter((f) => f.friend_id !== friendId));
    } catch (err) {
      console.error("Error removing friend:", err);
      setError("Failed to remove friend");
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm]);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex mb-6 rounded-lg overflow-hidden">
        <button
          className={`flex-1 px-4 py-2 text-center transition-colors ${
            activeTab === "friends"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => setActiveTab("friends")}>
          Friends
        </button>
        <button
          className={`flex-1 px-4 py-2 text-center transition-colors ${
            activeTab === "requests"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
          onClick={() => setActiveTab("requests")}>
          Requests
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      )}

      {searchTerm && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Search Results</h3>
          {searchResults.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No users found</p>
          ) : (
            <div className="space-y-2">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {user.first_name} {user.last_name}
                    </div>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(user.id)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3">Your Friends</h3>
        {friends.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No friends yet</p>
        ) : (
          <div className="space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div>
                  <div className="font-medium">{friend.profiles?.username || "Unknown User"}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {friend.profiles?.first_name || ""} {friend.profiles?.last_name || ""}
                  </div>
                </div>
                <button
                  onClick={() => removeFriend(friend.friend_id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
