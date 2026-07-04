import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

function getSigningSecret(): string {
  const secret = process.env.OURA_STATE_SECRET || process.env.OURA_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing OURA_STATE_SECRET or OURA_CLIENT_SECRET for OAuth state signing");
  }
  return secret;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(payload).digest("base64url");
}

export function createOuraOAuthState(userId: string): string {
  const data = {
    userId,
    exp: Date.now() + STATE_TTL_MS,
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function verifyOuraOAuthState(state: string): { userId: string } {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) {
    throw new Error("Invalid OAuth state");
  }

  const payload = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const expectedSignature = signPayload(payload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid OAuth state signature");
  }

  const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
    userId?: string;
    exp?: number;
  };

  if (!data.userId) {
    throw new Error("Invalid OAuth state payload");
  }

  if (!data.exp || Date.now() > data.exp) {
    throw new Error("OAuth state expired");
  }

  return { userId: data.userId };
}
