import { AppError, type AppConfig } from "./types.js";

const SAFE_REPOSITORY_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function required(env: NodeJS.ProcessEnv, name: string, secret = false): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new AppError("CONFIGURATION_ERROR", 500, `Missing required environment variable ${name}.`);
  }
  if (secret && value.length < 12) {
    throw new AppError("CONFIGURATION_ERROR", 500, `${name} must contain at least 12 characters.`);
  }
  return value;
}

function repositoryValue(env: NodeJS.ProcessEnv, name: string): string {
  const value = required(env, name);
  if (!SAFE_REPOSITORY_VALUE.test(value)) {
    throw new AppError("CONFIGURATION_ERROR", 500, `${name} contains unsupported characters.`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const github = Object.freeze({
    token: required(env, "GITHUB_TOKEN", true),
    owner: repositoryValue(env, "GITHUB_OWNER"),
    repo: repositoryValue(env, "GITHUB_REPO"),
    baseBranch: repositoryValue(env, "GITHUB_BASE_BRANCH"),
  });
  return Object.freeze({
    captureApiKey: required(env, "CAPTURE_API_KEY", true),
    github,
  });
}
