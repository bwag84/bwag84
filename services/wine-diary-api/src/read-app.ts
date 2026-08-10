import { ZodError } from "zod";

import { describeAuthorizationFailure, isAuthorized } from "./auth.js";
import {
  createWineCatalogueReader,
  GitHubWineCatalogueSource,
  type WineCatalogueReader,
} from "./catalogue.js";
import { loadConfig } from "./config.js";
import {
  findTasteContext,
  parseTasteContextRequest,
} from "./taste-context.js";
import { buildTasteProfile } from "./taste-profile.js";
import {
  AppError,
  type AppConfig,
  type AuthorizationDiagnostic,
} from "./types.js";

export interface ReadAppDependencies {
  config: AppConfig;
  catalogue: WineCatalogueReader;
  reportAuthFailure?: (diagnostic: AuthorizationDiagnostic) => void;
}

let warmDependencies: ReadAppDependencies | null = null;

function json(value: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "private, no-store",
      ...headers,
    },
  });
}

function errorResponse(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

function publicReadError(error: unknown): Response {
  if (error instanceof AppError) {
    return errorResponse(error.code, error.publicMessage, error.status);
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return errorResponse(
      "INVALID_TASTE_QUERY",
      "Provide at least one wine, grape, region, country, tag, or tasting clue.",
      400,
    );
  }
  return errorResponse(
    "HISTORY_UNAVAILABLE",
    "The published wine history is temporarily unavailable. Please retry.",
    502,
  );
}

function defaultReadDependencies(): ReadAppDependencies {
  if (warmDependencies !== null) return warmDependencies;
  const config = loadConfig(process.env);
  const source = new GitHubWineCatalogueSource(config.github);
  warmDependencies = {
    config,
    catalogue: createWineCatalogueReader(source),
    reportAuthFailure: (diagnostic) =>
      console.warn("taste memory authorization rejected", diagnostic),
  };
  return warmDependencies;
}

function authorize(
  request: Request,
  dependencies: ReadAppDependencies,
): Response | null {
  const authorizationHeader = request.headers.get("authorization") ?? undefined;
  if (isAuthorized(authorizationHeader, dependencies.config.captureApiKey)) return null;

  dependencies.reportAuthFailure?.(
    describeAuthorizationFailure(
      authorizationHeader,
      dependencies.config.captureApiKey,
    ),
  );
  return errorResponse(
    "UNAUTHORIZED",
    "The taste-memory request was not authorized.",
    401,
  );
}

export async function handleTasteProfile(
  request: Request,
  dependencies: ReadAppDependencies = defaultReadDependencies(),
): Promise<Response> {
  if (request.method !== "GET") {
    return json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use GET for the personal taste profile.",
        },
      },
      405,
      { allow: "GET" },
    );
  }

  const unauthorized = authorize(request, dependencies);
  if (unauthorized) return unauthorized;

  try {
    return json(buildTasteProfile(await dependencies.catalogue.read()), 200);
  } catch (error) {
    return publicReadError(error);
  }
}

export async function handleTasteContext(
  request: Request,
  dependencies: ReadAppDependencies = defaultReadDependencies(),
): Promise<Response> {
  if (request.method !== "POST") {
    return json(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Use POST for personal taste context.",
        },
      },
      405,
      { allow: "POST" },
    );
  }

  const unauthorized = authorize(request, dependencies);
  if (unauthorized) return unauthorized;

  try {
    const query = parseTasteContextRequest(await request.json());
    const wines = await dependencies.catalogue.read();
    return json(findTasteContext(wines, query), 200);
  } catch (error) {
    return publicReadError(error);
  }
}
