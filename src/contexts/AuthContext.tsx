import { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { UserProfile } from "../types/social";
import { getUserLocation, updateUserLocation } from "../utils/socialService";
import { supabase } from "../utils/supabaseClient";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  setUserProfile: Dispatch<SetStateAction<UserProfile | null>>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchUserProfile = useCallback(async (userId: string, currentSession: Session | null) => {
    if (lastFetchedUserIdRef.current === userId) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

      if (error && error.code === "PGRST116") {
        const location = await getUserLocation();
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            username: currentSession?.user?.email?.split("@")[0],
            location,
          })
          .select("*")
          .single();

        if (newProfile && !createError) {
          setUserProfile({ ...newProfile, timer_duration: newProfile.timer_duration || 300 });
          lastFetchedUserIdRef.current = userId;
        } else {
          console.error("AuthContext: Error creating profile:", createError);
          setUserProfile(null);
        }
      } else if (error) {
        console.error("AuthContext: Error fetching profile:", error);
        setUserProfile(null);
      } else if (data) {
        try {
          const updatedProfile = await updateUserLocation();
          setUserProfile({
            ...updatedProfile,
            timer_duration: updatedProfile.timer_duration || 300,
          });
          lastFetchedUserIdRef.current = userId;
        } catch (locationError) {
          console.error("AuthContext: Error updating location:", locationError);
          setUserProfile({ ...data, timer_duration: data.timer_duration || 300 });
          lastFetchedUserIdRef.current = userId;
        }
      }
    } catch (error) {
      console.error("AuthContext: Exception loading profile:", error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id, initialSession);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        if (lastFetchedUserIdRef.current !== nextSession.user.id) {
          fetchUserProfile(nextSession.user.id, nextSession);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
        lastFetchedUserIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    userProfile,
    loading,
    setUserProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
