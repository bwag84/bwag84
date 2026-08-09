import { timingSafeEqual } from "node:crypto";

import type { AuthorizationDiagnostic } from "./types.js";

export function describeAuthorizationFailure(
  authorizationHeader: string | undefined,
  expectedToken: string,
): AuthorizationDiagnostic {
  const match = /^([^\s]+)(?:\s+([^\s]+))?/.exec(authorizationHeader ?? "");

  return {
    headerPresent: Boolean(authorizationHeader),
    scheme: match?.[1] ?? null,
    presentedCredentialLength: match?.[2]?.length ?? 0,
    expectedCredentialLength: expectedToken.length,
  };
}

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
