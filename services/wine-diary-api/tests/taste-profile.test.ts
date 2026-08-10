import { describe, expect, it } from "vitest";

import { buildTasteProfile } from "../src/taste-profile.js";
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

describe("buildTasteProfile", () => {
  it("counts known evidence without treating unknown values as negative", () => {
    const profile = buildTasteProfile([
      wine({
        id: "a",
        date: "2026-04-01",
        rating: 89,
        wouldBuyAgain: true,
        grapes: ["Cabernet Sauvignon"],
        country: "France",
      }),
      wine({
        id: "b",
        date: "2026-03-01",
        rating: 85,
        wouldBuyAgain: true,
        grapes: ["Primitivo"],
        country: "Italy",
      }),
      wine({
        id: "c",
        date: "2026-02-01",
        rating: 80,
        wouldBuyAgain: false,
        grapes: ["Verdejo"],
        country: "Spain",
      }),
      wine({
        id: "d",
        date: "2026-01-01",
        status: "benchmark",
        grapes: ["Cabernet Sauvignon"],
      }),
    ]);

    expect(profile.generatedFrom).toBe(4);
    expect(profile.summary).toEqual({
      totalWines: 4,
      ratedWines: 3,
      averageRating: 84.7,
      buyAgainYes: 2,
      buyAgainNo: 1,
      buyAgainUnknown: 1,
      benchmarks: 1,
    });
    expect(profile.favorites.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(profile.dislikes.map((entry) => entry.id)).toEqual(["c"]);
    expect(profile.benchmarks.map((entry) => entry.id)).toEqual(["d"]);
  });

  it("marks evidence as repeated only when at least two wines support it", () => {
    const profile = buildTasteProfile([
      wine({
        id: "a",
        rating: 89,
        wouldBuyAgain: true,
        grapes: ["Cabernet Sauvignon"],
        region: "Bordeaux",
        tags: ["Red"],
      }),
      wine({
        id: "b",
        status: "benchmark",
        wouldBuyAgain: true,
        grapes: ["cabernet sauvignon"],
        region: "Bordeaux",
        tags: ["red"],
      }),
      wine({
        id: "c",
        rating: 91,
        wouldBuyAgain: true,
        grapes: ["Chardonnay"],
        region: "Chablis",
        tags: ["white"],
      }),
    ]);

    const cabernet = profile.evidence.grapes.find(
      (item) => item.term === "Cabernet Sauvignon",
    );
    const chardonnay = profile.evidence.grapes.find(
      (item) => item.term === "Chardonnay",
    );
    const red = profile.evidence.tags.find((item) => item.term === "Red");

    expect(cabernet).toMatchObject({
      count: 2,
      ratedCount: 1,
      averageRating: 89,
      buyAgainYes: 2,
      buyAgainNo: 0,
      repeated: true,
      wineIds: ["a", "b"],
    });
    expect(chardonnay).toMatchObject({
      count: 1,
      repeated: false,
      wineIds: ["c"],
    });
    expect(red).toMatchObject({ count: 2, repeated: true });
  });

  it("sorts evidence by count then term and puts unrated favorites last", () => {
    const profile = buildTasteProfile([
      wine({ id: "unrated", date: "2026-03-01", wouldBuyAgain: true, tags: ["zeta"] }),
      wine({ id: "rated", date: "2026-01-01", rating: 70, wouldBuyAgain: true, tags: ["alpha"] }),
      wine({ id: "two", date: "2026-02-01", tags: ["zeta"] }),
    ]);

    expect(profile.favorites.map((entry) => entry.id)).toEqual(["rated", "unrated"]);
    expect(profile.evidence.tags.map((entry) => entry.term)).toEqual(["zeta", "alpha"]);
  });
});
