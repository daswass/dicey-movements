import { createHmac, timingSafeEqual } from "crypto";

export interface OuraWebhookEvent {
  event_type: "create" | "update" | "delete";
  data_type: "daily_activity" | "daily_readiness" | "workout";
  event_datetime: string;
  object_id: string;
  user_id: string;
}

const EVENT_TYPES = new Set<OuraWebhookEvent["event_type"]>(["create", "update", "delete"]);
const DATA_TYPES = new Set<OuraWebhookEvent["data_type"]>([
  "daily_activity",
  "daily_readiness",
  "workout",
]);

function safeEqual(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

export function isValidOuraWebhookSignature(
  rawBody: Buffer | undefined,
  suppliedSignature: unknown,
  clientSecret: string | undefined
): boolean {
  if (!rawBody || typeof suppliedSignature !== "string" || !clientSecret) {
    return false;
  }

  const expectedSignature = createHmac("sha256", clientSecret).update(rawBody).digest("hex");
  return safeEqual(suppliedSignature, expectedSignature);
}

export function parseOuraWebhookEvent(payload: unknown): OuraWebhookEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const { event_type, data_type, event_datetime, object_id, user_id } = candidate;
  if (
    typeof event_type !== "string" ||
    !EVENT_TYPES.has(event_type as OuraWebhookEvent["event_type"]) ||
    typeof data_type !== "string" ||
    !DATA_TYPES.has(data_type as OuraWebhookEvent["data_type"]) ||
    typeof object_id !== "string" ||
    object_id.length === 0 ||
    typeof user_id !== "string" ||
    user_id.length === 0 ||
    typeof event_datetime !== "string" ||
    Number.isNaN(Date.parse(event_datetime))
  ) {
    return null;
  }

  return { event_type, data_type, event_datetime, object_id, user_id } as OuraWebhookEvent;
}

export class OuraWebhookReplayProtector {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly maxEntries = 10_000
  ) {}

  isReplay(event: OuraWebhookEvent, now = Date.now()): boolean {
    this.prune(now);
    const key = [event.event_type, event.data_type, event.event_datetime, event.object_id, event.user_id].join(":");
    if (this.seen.has(key)) {
      return true;
    }

    this.seen.set(key, now + this.ttlMs);
    if (this.seen.size > this.maxEntries) {
      const oldestKey = this.seen.keys().next().value;
      if (oldestKey) this.seen.delete(oldestKey);
    }
    return false;
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
  }
}
