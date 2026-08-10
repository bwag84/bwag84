import { describe, expect, it } from "vitest";

import {
  findTasteContext,
  parseTasteContextRequest,
} from "../src/taste-context.js";
import type { WineMemory } from "../src/wine-memory.js";

function wine(overrides: Partial<WineMemory>): WineMemory {
  return {
    id: "wine",
    title: "Wine",
    date: "2026-01-01",
    producer: null,
    vintage: null,
    country: null,
    region: null,
    grapes: [],
    tags: [],
    rating: null,
    ratingLabel: null,
    verdict: null,
    wouldBuyAgain: null,
    status: "drunk",
    firstImpression: null,
    whatINoticed: null,
    verdictText: null,
    context: null,
    url: "https://example.test/wine",
    ...overrides,
  };
}

describe("taste context", () => {
  it("requires at least one non-empty clue and defaults the limit", () => {
    expect(() => parseTasteContextRequest({})).toThrow();
    expect(() => parseTasteContextRequest({ grapes: [], tags: [] })).toThrow();
    expect(
      parseTasteContextRequest({ grapes: ["Cabernet Sauvignon"] }),
    ).toEqual({
      grapes: ["Cabernet Sauvignon"],
      tags: [],
      limit: 5,
    });
  });

  it("trims clues, rejects unknown properties, and enforces the result limit", () => {
    expect(
      parseTasteContextRequest({
        query: "  dark cherry  ",
        region: "  Pays d’Oc  ",
        limit: 8,
      }),
    ).toEqual({
      query: "dark cherry",
      region: "Pays d’Oc",
      grapes: [],
      tags: [],
      limit: 8,
    });
    expect(() => parseTasteContextRequest({ query: "wine", limit: 9 })).toThrow();
    expect(() => parseTasteContextRequest({ query: "wine", extra: true })).toThrow();
  });

  it("ranks exact identity ahead of grape and prose matches and explains each match", () => {
    const wines = [
      wine({
        id: "identity",
        title: "Dumanet Cabernet Sauvignon",
        producer: "Dumanet",
        grapes: ["Cabernet Sauvignon"],
        rating: 89,
      }),
      wine({
        id: "grape",
        title: "Bordeaux",
        grapes: ["Cabernet Sauvignon"],
        rating: 92,
      }),
      wine({
        id: "prose",
        title: "Other",
        whatINoticed: "Cabernet-like dark cherry",
        rating: 95,
      }),
    ];

    const result = findTasteContext(wines, {
      query: "Dumanet Cabernet Sauvignon",
      grapes: ["Cabernet Sauvignon"],
      tags: [],
      limit: 3,
    });

    expect(result.matches.map((match) => match.wine.id)).toEqual([
      "identity",
      "grape",
      "prose",
    ]);
    expect(result.matches[0]?.matchedOn).toEqual(
      expect.arrayContaining([
        "title",
        "producer",
        "grape:Cabernet Sauvignon",
      ]),
    );
    expect(result.totalWines).toBe(3);
  });

  it("matches normalized accents and partial structured regions", () => {
    const result = findTasteContext(
      [
        wine({
          id: "south",
          region: "Pays d’Oc, Southern France",
          country: "France",
          tags: ["Rosé"],
        }),
      ],
      {
        grapes: [],
        region: "Pays d'Oc",
        country: "france",
        tags: ["rose"],
        limit: 5,
      },
    );

    expect(result.matches[0]?.matchedOn).toEqual([
      "region:Pays d'Oc",
      "country:france",
      "tag:rose",
    ]);
  });

  it("uses benchmark, buy-again, and rating only as small tie breakers", () => {
    const result = findTasteContext(
      [
        wine({
          id: "ordinary",
          tags: ["red"],
          rating: 90,
          wouldBuyAgain: false,
        }),
        wine({
          id: "benchmark",
          tags: ["red"],
          rating: 85,
          wouldBuyAgain: true,
          status: "benchmark",
        }),
        wine({
          id: "irrelevant",
          status: "benchmark",
          rating: 100,
          wouldBuyAgain: true,
        }),
      ],
      { tags: ["red"], grapes: [], limit: 2 },
    );

    expect(result.matches.map((match) => match.wine.id)).toEqual([
      "benchmark",
      "ordinary",
    ]);
  });

  it("caps matches at the requested limit", () => {
    const result = findTasteContext(
      [wine({ id: "a", tags: ["red"] }), wine({ id: "b", tags: ["red"] })],
      { grapes: [], tags: ["red"], limit: 1 },
    );
    expect(result.matches).toHaveLength(1);
  });
});
