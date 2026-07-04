import { supabase } from "./supabaseClient";

let cachedUserId: string | null = null;
let cachedAccessToken: string | null = null;

export function syncAuthSession(userId: string | null, accessToken: string | null) {
  cachedUserId = userId;
  cachedAccessToken = accessToken;
}

export function getAuthUserId(): string | null {
  return cachedUserId;
}

export async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export async function requireAuthUserId(): Promise<string> {
  if (cachedUserId) {
    return cachedUserId;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user.id;
}
