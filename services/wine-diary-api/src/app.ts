import { ZodError } from "zod";

import { describeAuthorizationFailure, isAuthorized } from "./auth.js";
import { loadConfig } from "./config.js";
import { OctokitRepositoryGateway } from "./github.js";
import { normalizeBottlePhoto } from "./image.js";
import { publishCapture } from "./publisher.js";
import { parseCaptureRequest } from "./schema.js";
import { AppError, type AppDependencies, type PublishResult } from "./types.js";

function json(value: unknown, status: number, headers: HeadersInit = {}): Response {
  return Response.json(value, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function publicError(error: unknown): Response {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.publicMessage } }, error.status);
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return json(
      {
        error: {
          code: "INVALID_CAPTURE",
          message: "The confirmed wine capture did not match the required structure.",
        },
      },
      400,
    );
  }
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The wine draft could not be created. Please try again.",
      },
    },
    500,
  );
}

function success(result: PublishResult): Response {
  return json(
    {
      status: result.status,
      capture_id: result.captureId,
      pull_request_url: result.pullRequestUrl,
      content_path: result.contentPath,
      image_path: result.imagePath,
    },
    result.status === "created" ? 201 : 200,
  );
}

function defaultDependencies(): AppDependencies {
  const config = loadConfig(process.env);
  const gateway = new OctokitRepositoryGateway(config.github);
  return {
    config,
    now: () => new Date(),
    normalizePhoto: normalizeBottlePhoto,
    publish: (input) => publishCapture(input, gateway),
    reportAuthFailure: (diagnostic) => console.warn("capture authorization rejected", diagnostic),
  };
}

export async function handleCapture(
  request: Request,
  dependencies: AppDependencies = defaultDependencies(),
): Promise<Response> {
  if (request.method !== "POST") {
    return json(
      { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST for wine captures." } },
      405,
      { allow: "POST" },
    );
  }
  const authorizationHeader = request.headers.get("authorization") ?? undefined;
  if (!isAuthorized(authorizationHeader, dependencies.config.captureApiKey)) {
    dependencies.reportAuthFailure?.(
      describeAuthorizationFailure(authorizationHeader, dependencies.config.captureApiKey),
    );
    return json(
      { error: { code: "UNAUTHORIZED", message: "The capture request was not authorized." } },
      401,
    );
  }

  try {
    const raw = await request.json();
    const capture = parseCaptureRequest(raw, dependencies.now());
    const photo = capture.file ? await dependencies.normalizePhoto(capture.file) : null;
    const result = await dependencies.publish({ capture, photo });
    return success(result);
  } catch (error) {
    return publicError(error);
  }
}
