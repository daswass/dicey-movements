import { timingSafeEqual } from "crypto";

export function isValidOuraWebhookToken(
  suppliedToken: unknown,
  expectedToken: string | undefined
): boolean {
  if (typeof suppliedToken !== "string" || !expectedToken) {
    return false;
  }

  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(expectedToken);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
