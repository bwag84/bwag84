import { describe, expect, it } from "vitest";

import { isAuthorized } from "../src/auth.js";

describe("isAuthorized", () => {
  it("rejects missing credentials", () => {
    expect(isAuthorized(undefined, "secret-value")).toBe(false);
  });

  it("rejects non-Bearer credentials", () => {
    expect(isAuthorized("Basic secret-value", "secret-value")).toBe(false);
  });

  it("rejects a wrong-length credential", () => {
    expect(isAuthorized("Bearer no", "secret-value")).toBe(false);
  });

  it("rejects a same-length incorrect credential", () => {
    expect(isAuthorized("Bearer wrong-secret", "secret-value")).toBe(false);
  });

  it("accepts the exact Bearer credential", () => {
    expect(isAuthorized("Bearer secret-value", "secret-value")).toBe(true);
  });
});
