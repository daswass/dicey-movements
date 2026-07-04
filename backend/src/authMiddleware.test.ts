import type { NextFunction, Request, Response } from "express";

const mockGetUser = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

process.env.SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

import {
  requireAuth,
  requireSelfBody,
  requireSelfFromUserIdField,
  requireSelfParam,
} from "./authMiddleware";

function createMockResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe("authMiddleware", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("requireAuth rejects missing bearer token", async () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Authorization required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAuth attaches user for valid token", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    const req = {
      headers: { authorization: "Bearer valid-token" },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith("valid-token");
    expect(req.authUser).toEqual({ id: "user-123" });
    expect(next).toHaveBeenCalled();
  });

  it("requireSelfParam blocks access to another user id", () => {
    const req = {
      authUser: { id: "user-123" },
      params: { userId: "other-user" },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireSelfParam()(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("requireSelfBody allows matching user id", () => {
    const req = {
      authUser: { id: "user-123" },
      body: { userId: "user-123" },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireSelfBody()(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("requireSelfFromUserIdField blocks mismatched sender", () => {
    const req = {
      authUser: { id: "user-123" },
      body: { fromUserId: "other-user" },
    } as unknown as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    requireSelfFromUserIdField()(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
