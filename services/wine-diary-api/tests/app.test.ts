import { describe, expect, it, vi } from "vitest";

import { handleCapture } from "../src/app.js";
import { AppError, type PublishResult } from "../src/types.js";

const validCapture = {
  capture_id: "capture-20260808-abc123",
  wine: {
    title: "Example Gewürztraminer 2024",
    date: "2026-08-08",
    producer: "Example Producer",
    vintage: "2024",
    country: "France",
    region: "Alsace",
    grapes: ["Gewürztraminer"],
    rating: 84,
    verdict: "Pass",
    would_buy_again: "No",
    status: "drunk",
    tags: ["white", "Alsace"],
  },
  review: {
    first_impression: "Aromatic and generous.",
    what_i_noticed: "Rose, lychee and spice.",
    verdict: "84/100. A Pass in the right setting.",
    context: "Excellent with white fish but medicinal on its own.",
  },
  openaiFileIdRefs: [],
};

const created: PublishResult = {
  status: "created",
  captureId: "capture-20260808-abc123",
  pullRequestUrl: "https://github.com/bwag84/bwag84/pull/123",
  contentPath: "content/wine/2026-08-08-example.md",
  imagePath: null,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      captureApiKey: "capture-secret",
      github: { token: "github-secret", owner: "bwag84", repo: "bwag84", baseBranch: "main" },
    },
    now: () => new Date("2026-08-08T12:00:00Z"),
    normalizePhoto: vi.fn(async () => Buffer.from("webp")),
    publish: vi.fn(async () => created),
    ...overrides,
  };
}

function request(body: unknown = validCapture, authorization = "Bearer capture-secret"): Request {
  return new Request("https://capture.example/v1/captures", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleCapture", () => {
  it("rejects non-POST methods", async () => {
    const response = await handleCapture(
      new Request("https://capture.example/v1/captures", { method: "GET" }),
      dependencies(),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("authenticates before reading or validating the body", async () => {
    const response = await handleCapture(request("not valid", "Bearer wrong-secret"), dependencies());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "The capture request was not authorized." },
    });
  });

  it("reports secret-safe diagnostics when authorization is rejected", async () => {
    const authFailures: unknown[] = [];

    await handleCapture(
      request("not valid", "Basic presented-secret"),
      dependencies({ reportAuthFailure: (diagnostic: unknown) => authFailures.push(diagnostic) }),
    );

    expect(authFailures).toEqual([{
      headerPresent: true,
      scheme: "Basic",
      presentedCredentialLength: 16,
      expectedCredentialLength: 14,
    }]);
    expect(JSON.stringify(authFailures)).not.toContain("presented-secret");
    expect(JSON.stringify(authFailures)).not.toContain("capture-secret");
  });

  it("rejects malformed JSON with a stable public error", async () => {
    const malformed = new Request("https://capture.example/v1/captures", {
      method: "POST",
      headers: { authorization: "Bearer capture-secret", "content-type": "application/json" },
      body: "{not-json",
    });

    const response = await handleCapture(malformed, dependencies());

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_CAPTURE" } });
  });

  it("rejects schema-invalid JSON without calling downstream dependencies", async () => {
    const deps = dependencies();

    const response = await handleCapture(request({ capture_id: "short" }), deps);

    expect(response.status).toBe(400);
    expect(deps.normalizePhoto).not.toHaveBeenCalled();
    expect(deps.publish).not.toHaveBeenCalled();
  });

  it("creates a photo-free draft without invoking image processing", async () => {
    const deps = dependencies();

    const response = await handleCapture(request(), deps);

    expect(response.status).toBe(201);
    expect(deps.normalizePhoto).not.toHaveBeenCalled();
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ photo: null }));
    expect(await response.json()).toEqual({
      status: "created",
      capture_id: created.captureId,
      pull_request_url: created.pullRequestUrl,
      content_path: created.contentPath,
      image_path: null,
    });
  });

  it("downloads a supplied photo before publishing", async () => {
    const file = {
      name: "bottle.jpeg",
      id: "file-123",
      mime_type: "image/jpeg",
      download_link: "https://files.oaiusercontent.com/signed-photo?sig=secret",
    };
    const deps = dependencies();

    await handleCapture(request({ ...validCapture, openaiFileIdRefs: [file] }), deps);

    expect(deps.normalizePhoto).toHaveBeenCalledWith(file);
    expect(deps.publish).toHaveBeenCalledWith(expect.objectContaining({ photo: Buffer.from("webp") }));
  });

  it("returns 200 for an idempotent replay", async () => {
    const existing = { ...created, status: "already_exists" as const };
    const response = await handleCapture(
      request(),
      dependencies({ publish: vi.fn(async () => existing) }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "already_exists" });
  });

  it("preserves recoverable photo errors without exposing signed links", async () => {
    const signedLink = "https://files.oaiusercontent.com/photo?sig=do-not-return";
    const photoCapture = {
      ...validCapture,
      openaiFileIdRefs: [{
        name: "bottle.jpeg",
        id: "file-123",
        mime_type: "image/jpeg",
        download_link: signedLink,
      }],
    };
    const response = await handleCapture(
      request(photoCapture),
      dependencies({
        normalizePhoto: vi.fn(async () => {
          throw new AppError(
            "PHOTO_EXPIRED",
            400,
            "The temporary bottle photo link expired. Please attach the photo again.",
          );
        }),
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(400);
    expect(text).toContain("PHOTO_EXPIRED");
    expect(text).not.toContain(signedLink);
  });

  it("maps redacted GitHub failures to 502", async () => {
    const response = await handleCapture(
      request(),
      dependencies({
        publish: vi.fn(async () => {
          throw new AppError(
            "GITHUB_UNAVAILABLE",
            502,
            "GitHub is temporarily unavailable. Please retry this capture.",
          );
        }),
      }),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "GITHUB_UNAVAILABLE" } });
  });
});
