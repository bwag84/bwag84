import { describe, expect, it, vi } from "vitest";

import { handleTasteContext, handleTasteProfile } from "../src/read-app.js";
import { AppError, type AppConfig } from "../src/types.js";
import type { WineCatalogueReader } from "../src/catalogue.js";
import type { WineMemory } from "../src/wine-memory.js";

const config: AppConfig = {
  captureApiKey: "secret-value",
  github: Object.freeze({
    token: "github-secret",
    owner: "bwag84",
    repo: "bwag84",
    baseBranch: "main",
  }),
};

function dependencies(wines: WineMemory[] = []) {
  return {
    config,
    catalogue: {
      read: vi.fn().mockResolvedValue(wines),
    } satisfies WineCatalogueReader,
    reportAuthFailure: vi.fn(),
  };
}

describe("taste read handlers", () => {
  it("requires GET and Bearer auth for the profile", async () => {
    const deps = dependencies();
    const method = await handleTasteProfile(
      new Request("https://example.test/v1/taste-profile", { method: "POST" }),
      deps,
    );
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET");

    const unauthorized = await handleTasteProfile(
      new Request("https://example.test/v1/taste-profile"),
      deps,
    );
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    expect(deps.catalogue.read).not.toHaveBeenCalled();
    expect(deps.reportAuthFailure).toHaveBeenCalledWith({
      headerPresent: false,
      scheme: null,
      presentedCredentialLength: 0,
      expectedCredentialLength: 12,
    });
  });

  it("returns the profile with private no-store caching", async () => {
    const response = await handleTasteProfile(
      new Request("https://example.test/v1/taste-profile", {
        headers: { authorization: "Bearer secret-value" },
      }),
      dependencies(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({
      generatedFrom: 0,
      summary: { totalWines: 0, averageRating: null },
    });
  });

  it("requires POST for context retrieval", async () => {
    const response = await handleTasteContext(
      new Request("https://example.test/v1/taste-context", {
        headers: { authorization: "Bearer secret-value" },
      }),
      dependencies(),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("maps an empty context query to INVALID_TASTE_QUERY before loading history", async () => {
    const deps = dependencies();
    const response = await handleTasteContext(
      new Request("https://example.test/v1/taste-context", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-value",
          "content-type": "application/json",
        },
        body: "{}",
      }),
      deps,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_TASTE_QUERY",
        message:
          "Provide at least one wine, grape, region, country, tag, or tasting clue.",
      },
    });
    expect(deps.catalogue.read).not.toHaveBeenCalled();
  });

  it("returns ranked context for a valid request", async () => {
    const wine: WineMemory = {
      id: "cabernet",
      title: "Cabernet",
      date: "2026-01-01",
      producer: null,
      vintage: null,
      country: "France",
      region: null,
      grapes: ["Cabernet Sauvignon"],
      tags: ["red"],
      rating: 89,
      ratingLabel: "89",
      verdict: "Pass",
      wouldBuyAgain: true,
      status: "drunk",
      firstImpression: null,
      whatINoticed: null,
      verdictText: null,
      context: null,
      url: "https://example.test/cabernet",
    };
    const response = await handleTasteContext(
      new Request("https://example.test/v1/taste-context", {
        method: "POST",
        headers: {
          authorization: "Bearer secret-value",
          "content-type": "application/json",
        },
        body: JSON.stringify({ grapes: ["Cabernet Sauvignon"] }),
      }),
      dependencies([wine]),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      totalWines: 1,
      matches: [{ matchedOn: ["grape:Cabernet Sauvignon"], wine: { id: "cabernet" } }],
    });
  });

  it("does not hide HISTORY_UNAVAILABLE behind an internal error", async () => {
    const deps = dependencies();
    deps.catalogue.read.mockRejectedValue(
      new AppError(
        "HISTORY_UNAVAILABLE",
        502,
        "The published wine history is temporarily unavailable. Please retry.",
      ),
    );
    const response = await handleTasteProfile(
      new Request("https://example.test/v1/taste-profile", {
        headers: { authorization: "Bearer secret-value" },
      }),
      deps,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "HISTORY_UNAVAILABLE",
        message:
          "The published wine history is temporarily unavailable. Please retry.",
      },
    });
  });

  it("maps unexpected catalogue failures to HISTORY_UNAVAILABLE", async () => {
    const deps = dependencies();
    deps.catalogue.read.mockRejectedValue(new Error("network details"));
    const response = await handleTasteProfile(
      new Request("https://example.test/v1/taste-profile", {
        headers: { authorization: "Bearer secret-value" },
      }),
      deps,
    );

    expect(response.status).toBe(502);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({
      error: { code: "HISTORY_UNAVAILABLE" },
    });
    expect(body).not.toContain("network details");
  });
});
