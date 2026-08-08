import { timingSafeEqual } from "node:crypto";

export function isAuthorized(
  authorizationHeader: string | undefined,
  expectedToken: string,
): boolean {
  const match = /^Bearer ([^\s]+)$/.exec(authorizationHeader ?? "");
  if (!match?.[1] || expectedToken.length === 0) return false;

  const presented = Buffer.from(match[1], "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(presented, expected);
}
