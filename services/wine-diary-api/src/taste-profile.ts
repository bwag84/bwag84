import type { WineMemory } from "./wine-memory.js";

export interface TasteEvidence {
  term: string;
  count: number;
  ratedCount: number;
  averageRating: number | null;
  buyAgainYes: number;
  buyAgainNo: number;
  repeated: boolean;
  wineIds: string[];
}

export interface TasteProfile {
  generatedFrom: number;
  summary: {
    totalWines: number;
    ratedWines: number;
    averageRating: number | null;
    buyAgainYes: number;
    buyAgainNo: number;
    buyAgainUnknown: number;
    benchmarks: number;
  };
  favorites: WineMemory[];
  dislikes: WineMemory[];
  benchmarks: WineMemory[];
  evidence: {
    grapes: TasteEvidence[];
    regions: TasteEvidence[];
    countries: TasteEvidence[];
    tags: TasteEvidence[];
  };
}

interface EvidenceAccumulator {
  term: string;
  wines: WineMemory[];
}

function roundedAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(average * 10) / 10;
}

function compareWines(left: WineMemory, right: WineMemory): number {
  const leftRating = left.rating ?? -1;
  const rightRating = right.rating ?? -1;
  return (
    rightRating - leftRating ||
    right.date.localeCompare(left.date) ||
    left.id.localeCompare(right.id)
  );
}

function evidenceFor(
  wines: WineMemory[],
  values: (wine: WineMemory) => string[],
): TasteEvidence[] {
  const accumulators = new Map<string, EvidenceAccumulator>();

  for (const wine of wines) {
    const valuesForWine = new Map<string, string>();
    for (const rawTerm of values(wine)) {
      const term = rawTerm.trim();
      if (term.length > 0) valuesForWine.set(term.toLowerCase(), term);
    }

    for (const [key, term] of valuesForWine) {
      const accumulator = accumulators.get(key);
      if (accumulator) accumulator.wines.push(wine);
      else accumulators.set(key, { term, wines: [wine] });
    }
  }

  return [...accumulators.values()]
    .map(({ term, wines: supportingWines }): TasteEvidence => {
      const ratings = supportingWines
        .map(({ rating }) => rating)
        .filter((rating): rating is number => rating !== null);
      return {
        term,
        count: supportingWines.length,
        ratedCount: ratings.length,
        averageRating: roundedAverage(ratings),
        buyAgainYes: supportingWines.filter(({ wouldBuyAgain }) => wouldBuyAgain === true).length,
        buyAgainNo: supportingWines.filter(({ wouldBuyAgain }) => wouldBuyAgain === false).length,
        repeated: supportingWines.length >= 2,
        wineIds: supportingWines.map(({ id }) => id),
      };
    })
    .sort((left, right) => right.count - left.count || left.term.localeCompare(right.term));
}

export function buildTasteProfile(wines: WineMemory[]): TasteProfile {
  const ratings = wines
    .map(({ rating }) => rating)
    .filter((rating): rating is number => rating !== null);
  const favorites = wines.filter(({ wouldBuyAgain }) => wouldBuyAgain === true).sort(compareWines);
  const dislikes = wines.filter(({ wouldBuyAgain }) => wouldBuyAgain === false).sort(compareWines);
  const benchmarks = wines
    .filter(({ status }) => status === "benchmark")
    .sort(compareWines);

  return {
    generatedFrom: wines.length,
    summary: {
      totalWines: wines.length,
      ratedWines: ratings.length,
      averageRating: roundedAverage(ratings),
      buyAgainYes: favorites.length,
      buyAgainNo: dislikes.length,
      buyAgainUnknown: wines.filter(({ wouldBuyAgain }) => wouldBuyAgain === null).length,
      benchmarks: benchmarks.length,
    },
    favorites,
    dislikes,
    benchmarks,
    evidence: {
      grapes: evidenceFor(wines, ({ grapes }) => grapes),
      regions: evidenceFor(wines, ({ region }) => (region ? [region] : [])),
      countries: evidenceFor(wines, ({ country }) => (country ? [country] : [])),
      tags: evidenceFor(wines, ({ tags }) => tags),
    },
  };
}
