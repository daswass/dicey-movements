import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY for auth middleware");
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return res.status(401).json({ error: "Authorization required" });
  }

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.authUser = user;
  return next();
}

export function requireSelfParam(paramName = "userId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedId = req.params[paramName];
    if (!req.authUser) {
      return res.status(401).json({ error: "Authorization required" });
    }
    if (requestedId && requestedId !== req.authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

export function requireSelfBody(fieldName = "userId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedId = req.body?.[fieldName];
    if (!req.authUser) {
      return res.status(401).json({ error: "Authorization required" });
    }
    if (requestedId && requestedId !== req.authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

export function requireSelfFromUserIdField(fieldName = "fromUserId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestedId = req.body?.[fieldName];
    if (!req.authUser) {
      return res.status(401).json({ error: "Authorization required" });
    }
    if (requestedId !== req.authUser.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
