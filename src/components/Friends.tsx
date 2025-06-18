import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";

// Clarify Friend interface properties to indicate who initiated
interface Friend {
  id: string; // The ID of the friendship record itself
  user_id: string; // The ID of the user who INITIATED the request (from the DB record)
  friend_id: string; // The ID of the user who RECEIVED the request (from the DB record)
  status: "pending" | "accepted";
  created_at: string;
  // This 'profiles' field will store the data of the *other* person in the relationship
  profiles: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
}

// Extend User interface for search results to include relationship status
interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  relationshipStatus?: "none" | "friend" | "pending_outgoing" | "pending_incoming";
  friendshipRecordId?: string; // For incoming requests in search results, we need the friendship record ID
}

// NEW INTERFACE: Define the exact shape of the raw data returned by the select query
interface RawFriendRecord {
  id: string;
  user_id: string; // Corresponds to friends.user_id
  friend_id: string; // Corresponds to friends.friend_id
  status: "pending" | "accepted";
  created_at: string;
  // These match the aliases in your .select() query
  initiator_profile: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
  receiver_profile: {
    first_name: string | null;
    last_name: string | null;
    username: string | null;
  } | null;
}

export const Friends: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]); // Accepted friends
  const [pendingFriends, setPendingFriends] = useState<Friend[]>([]); // Requests I sent (outgoing)
  const [incomingRequests, setIncomingRequests] = useState<Friend[]>([]); // Requests sent TO ME (incoming)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"friends" | "requests">("friends");

  // Fetch all friend relationships related to the current user
  const fetchFriends = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("friends")
        .select(
          `
          id,
          user_id,
          friend_id,
          status,
          created_at,
          initiator_profile:profiles!user_id (first_name, last_name, username),
          receiver_profile:profiles!friend_id (first_name, last_name, username)
          `
        ) // Ensure absolutely NOTHING else is inside these backticks
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) throw error;

      // --- CRITICAL FIX: Explicitly cast the fetched data ---
      const typedFriendRecords: RawFriendRecord[] = data as RawFriendRecord[];

      const acceptedRaw: Friend[] = []; // Temporary array to hold all accepted records before de-duplication
      const sentByMe: Friend[] = [];
      const sentToMe: Friend[] = [];

      typedFriendRecords?.forEach((record) => {
        const isOutgoing = record.user_id === user.id; // True if I initiated the request
        // Determine which profile is the 'other' user in this record
        const otherUserProfile = isOutgoing ? record.receiver_profile : record.initiator_profile;

        const friendEntry: Friend = {
          id: record.id,
          user_id: record.user_id,
          friend_id: record.friend_id,
          status: record.status,
          created_at: record.created_at,
          profiles: otherUserProfile,
        };

        if (record.status === "accepted") {
          acceptedRaw.push(friendEntry); // Add to raw accepted list
        } else if (record.status === "pending") {
          if (isOutgoing) {
            sentByMe.push(friendEntry);
          } else {
            sentToMe.push(friendEntry);
          }
        }
      });

      // --- De-duplicate accepted friends ---
      // This part ensures only one entry for each unique friendship appears in the list
      const seenFriendships = new Set<string>(); // To store normalized friend IDs for de-duplication
      const uniqueAcceptedFriends: Friend[] = [];

      acceptedRaw.forEach((friend) => {
        const currentUserId = user.id;
        // Get the ID of the actual friend (the *other* user in this specific record)
        const friendIdInRecord =
          friend.user_id === currentUserId ? friend.friend_id : friend.user_id;
        // Normalize the friendship key by sorting the two user IDs
        const normalizedKey = [currentUserId, friendIdInRecord].sort().join("-"); // e.g., "ID_A-ID_B"

        // If this normalized friendship hasn't been seen yet, add it to the unique list
        if (!seenFriendships.has(normalizedKey)) {
          seenFriendships.add(normalizedKey);
          uniqueAcceptedFriends.push(friend);
        }
      });
      // --- End de-duplication ---

      setFriends(uniqueAcceptedFriends); // Set the de-duplicated list for display
      setPendingFriends(sentByMe);
      setIncomingRequests(sentToMe);
      setError(null);
    } catch (err) {
      console.error("Error fetching friends:", err);
      setError("Failed to load friends");
    }
  }, []); // useCallback memoizes this function; it only re-creates if its dependencies change.

  // Search for users
  const searchUsers = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        setLoading(false); // Ensure loading is off if term is empty
        return;
      }

      setLoading(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false); // Ensure loading is off if no user
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, username")
          .or(
            `first_name.ilike.%<span class="math-inline">\{term\}%,last\_name\.ilike\.%</span>{term}%,username.ilike.%${term}%`
          )
          .neq("id", user.id); // Exclude current user from search results

        if (error) throw error;

        // Combine all relationships for efficient lookup
        const allRelationships = [...friends, ...pendingFriends, ...incomingRequests];

        const processedResults =
          data?.map((searchUser) => {
            const relationship = allRelationships.find(
              (rel) =>
                (rel.user_id === user.id && rel.friend_id === searchUser.id) || // I sent
                (rel.user_id === searchUser.id && rel.friend_id === user.id) // They sent
            );

            let status: User["relationshipStatus"] = "none";
            let friendshipRecordId: string | undefined = undefined;

            if (relationship) {
              if (relationship.status === "accepted") {
                status = "friend";
              } else if (relationship.status === "pending") {
                if (relationship.user_id === user.id) {
                  // I sent them a request
                  status = "pending_outgoing";
                } else if (relationship.friend_id === user.id) {
                  // They sent me a request
                  status = "pending_incoming";
                  friendshipRecordId = relationship.id; // Store the record ID for accepting
                }
              }
            }
            return { ...searchUser, relationshipStatus: status, friendshipRecordId };
          }) || [];

        // Filter: Show only users with no existing relationship OR users who sent a pending request TO ME (to allow accepting)
        const filteredResults = processedResults.filter(
          (u) => u.relationshipStatus === "none" || u.relationshipStatus === "pending_incoming"
        );

        setSearchResults(filteredResults);
      } catch (err) {
        console.error("Error searching users:", err);
        setError("Failed to search users");
      } finally {
        setLoading(false);
      }
    },
    [friends, pendingFriends, incomingRequests]
  ); // Depend on relationship lists for filtering

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
      // Re-fetch all friend lists to update UI
      await fetchFriends();
      setSearchTerm(""); // Clear search term after sending request
      setError(null);
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError("Failed to send friend request");
    }
  };

  // Accept incoming friend request
  const acceptFriendRequest = async (requestId: string, requesterUserId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Start a transaction to ensure atomicity
      const { error: rpcError } = await supabase.rpc("accept_friend_request_transaction", {
        friendship_record_id: requestId,
        current_user_id: user.id,
        requester_id: requesterUserId,
      });

      if (rpcError) throw rpcError;

      await fetchFriends(); // Re-fetch all friend lists
      setSearchTerm(""); // Clear search term after accepting
      setError(null);
    } catch (err) {
      console.error("Error accepting friend request:", err);
      setError("Failed to accept friend request");
    }
  };

  // Reject incoming friend request (delete the record)
  const rejectFriendRequest = async (requestId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("friends").delete().eq("id", requestId); // Delete the specific incoming request record

      if (error) throw error;
      await fetchFriends(); // Re-fetch all friend lists
      setError(null);
    } catch (err) {
      console.error("Error rejecting friend request:", err);
      setError("Failed to reject friend request");
    }
  };

  // Cancel outgoing friend request (delete the record)
  const cancelFriendRequest = async (requestId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("friends")
        .delete()
        .eq("id", requestId) // Delete the specific outgoing request record
        .eq("user_id", user.id) // Ensure current user initiated it
        .eq("status", "pending"); // Ensure it's a pending request

      if (error) throw error;
      await fetchFriends(); // Re-fetch all friend lists
      setError(null);
    } catch (err) {
      console.error("Error cancelling friend request:", err);
      setError("Failed to cancel friend request");
    }
  };

  // Remove an accepted friend (delete both reciprocal records)
  const removeFriend = async (friendId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Delete both reciprocal friend records (initiated by me or initiated by friend)
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.<span class="math-inline">\{user\.id\},friend\_id\.eq\.</span>{friendId}),and(user_id.eq.<span class="math-inline">\{friendId\},friend\_id\.eq\.</span>{user.id})`
        );

      if (error) throw error;
      await fetchFriends(); // Re-fetch all friend lists
      setError(null);
    } catch (err) {
      console.error("Error removing friend:", err);
      setError("Failed to remove friend");
    }
  };

  // Initial fetch of friends on component mount
  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]); // Depend on fetchFriends due to useCallback

  // Debounce search term for user search
  useEffect(() => {
    const debounce = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchTerm, searchUsers]); // Depend on searchUsers due to useCallback

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
          Requests ({incomingRequests.length + pendingFriends.length}) {/* Show total requests */}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        />
      </div>

      {/* Search Results Display */}
      {searchTerm && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Search Results</h3>
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          ) : searchResults.length === 0 ? (
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
                  {/* Render 'Accept' if it's an incoming pending request, otherwise 'Add Friend' */}
                  {user.relationshipStatus === "pending_incoming" ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => acceptFriendRequest(user.friendshipRecordId!, user.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                        Accept
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => sendFriendRequest(user.id)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                      Add Friend
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "friends" && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Your Friends ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              No friends yet. Search for users to add them!
            </p>
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
      )}

      {activeTab === "requests" && (
        <div className="mb-6">
          {/* Incoming Friend Requests */}
          {incomingRequests.length > 0 && ( // Condition: Only show if there are incoming requests
            <>
              {" "}
              {/* Use a React Fragment to group the heading and the list */}
              <h3 className="text-lg font-semibold mb-3">
                Incoming Requests ({incomingRequests.length})
              </h3>
              <div className="space-y-2 mb-6">
                {incomingRequests.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <div className="font-medium">
                        {friend.profiles?.username || "Unknown User"}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {friend.profiles?.first_name || ""} {friend.profiles?.last_name || ""}G
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => acceptFriendRequest(friend.id, friend.user_id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                        Accept
                      </button>
                      <button
                        onClick={() => rejectFriendRequest(friend.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Outgoing Friend Requests */}
          <h3 className="text-lg font-semibold mb-3">
            Outgoing Requests ({pendingFriends.length})
          </h3>
          {pendingFriends.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">
              Get out there! Find a buddy to challenge!
            </p>
          ) : (
            <div className="space-y-2">
              {pendingFriends.map((friend) => (
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
                    onClick={() => cancelFriendRequest(friend.id)}
                    className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors">
                    Cancel Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
