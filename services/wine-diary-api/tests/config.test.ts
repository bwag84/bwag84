import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config.js";

const validEnv = {
  CAPTURE_API_KEY: "capture-secret",
  GITHUB_TOKEN: "github-secret",
  GITHUB_OWNER: "bwag84",
  GITHUB_REPO: "bwag84",
  GITHUB_BASE_BRANCH: "main",
};

describe("loadConfig", () => {
  it("loads an immutable repository configuration", () => {
    const config = loadConfig(validEnv);

    expect(config).toEqual({
      captureApiKey: "capture-secret",
      github: {
        token: "github-secret",
        owner: "bwag84",
        repo: "bwag84",
        baseBranch: "main",
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.github)).toBe(true);
  });

  it.each(Object.keys(validEnv))("rejects missing variable %s without exposing other values", (name) => {
    const env = { ...validEnv };
    delete env[name as keyof typeof env];

    expect(() => loadConfig(env)).toThrow(name);
    try {
      loadConfig(env);
    } catch (error) {
      expect(String(error)).not.toContain("github-secret");
      expect(String(error)).not.toContain("capture-secret");
    }
  });

  it.each([
    ["GITHUB_OWNER", "../owner"],
    ["GITHUB_REPO", "repo/name"],
    ["GITHUB_BASE_BRANCH", "main branch"],
    ["GITHUB_BASE_BRANCH", "feature\nbranch"],
  ])("rejects unsafe %s values", (name, value) => {
    expect(() => loadConfig({ ...validEnv, [name]: value })).toThrow(name);
  });
});
