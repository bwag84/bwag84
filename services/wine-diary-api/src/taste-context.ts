import { z } from "zod";

import type { WineMemory } from "./wine-memory.js";

export interface TasteContextRequest {
  query?: string;
  grapes: string[];
  country?: string;
  region?: string;
  tags: string[];
  limit: number;
}

export interface TasteContextMatch {
  score: number;
  matchedOn: string[];
  wine: WineMemory;
}

export interface TasteContextResult {
  query: TasteContextRequest;
  totalWines: number;
  matches: TasteContextMatch[];
}

const clue = z.string().trim().min(1).max(200);
const tasteContextSchema = z
  .object({
    query: z.string().trim().min(1).max(500).optional(),
    grapes: z.array(clue).max(12).default([]),
    country: clue.optional(),
    region: clue.optional(),
    tags: z.array(clue).max(20).default([]),
    limit: z.number().int().min(1).max(8).default(5),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.query &&
      value.grapes.length === 0 &&
      !value.country &&
      !value.region &&
      value.tags.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "At least one taste clue is required",
      });
    }
  });

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function addMatch(matches: string[], label: string): void {
  if (!matches.includes(label)) matches.push(label);
}

function comparableMatch(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function compareMatches(left: TasteContextMatch, right: TasteContextMatch): number {
  return (
    right.score - left.score ||
    (right.wine.rating ?? -1) - (left.wine.rating ?? -1) ||
    right.wine.date.localeCompare(left.wine.date) ||
    left.wine.id.localeCompare(right.wine.id)
  );
}

function scoreWine(wine: WineMemory, request: TasteContextRequest): TasteContextMatch | null {
  let relevance = 0;
  const matchedOn: string[] = [];
  const normalizedTitle = normalize(wine.title);
  const normalizedProducer = wine.producer ? normalize(wine.producer) : "";

  if (request.query) {
    const normalizedQuery = normalize(request.query);
    if (normalizedQuery === normalizedTitle) {
      relevance += 100;
      addMatch(matchedOn, "title");
    }
    if (normalizedProducer && normalizedQuery === normalizedProducer) {
      relevance += 80;
      addMatch(matchedOn, "producer");
    }

    const queryTokens = tokens(request.query);
    const titleTokens = new Set(tokens(wine.title));
    const producerTokens = new Set(tokens(wine.producer ?? ""));
    const titleTokenMatches = queryTokens.filter((token) => titleTokens.has(token)).length;
    const producerTokenMatches = queryTokens.filter((token) => producerTokens.has(token)).length;
    if (titleTokenMatches > 0) {
      relevance += titleTokenMatches * 12;
      addMatch(matchedOn, "title");
    }
    if (producerTokenMatches > 0) {
      relevance += producerTokenMatches * 12;
      addMatch(matchedOn, "producer");
    }

    const reviewTokens = new Set(
      tokens(
        [
          wine.firstImpression,
          wine.whatINoticed,
          wine.verdictText,
          wine.context,
        ]
          .filter((value): value is string => value !== null)
          .join(" "),
      ),
    );
    const reviewScore = Math.min(
      queryTokens.filter((token) => reviewTokens.has(token)).length * 2,
      12,
    );
    if (reviewScore > 0) {
      relevance += reviewScore;
      addMatch(matchedOn, "review");
    }
  }

  for (const grape of request.grapes) {
    if (wine.grapes.some((candidate) => normalize(candidate) === normalize(grape))) {
      relevance += 35;
      addMatch(matchedOn, `grape:${grape}`);
    }
  }

  if (request.region && wine.region && comparableMatch(wine.region, request.region)) {
    relevance += 24;
    addMatch(matchedOn, `region:${request.region}`);
  }

  if (request.country && wine.country && normalize(wine.country) === normalize(request.country)) {
    relevance += 16;
    addMatch(matchedOn, `country:${request.country}`);
  }

  for (const tag of request.tags) {
    if (wine.tags.some((candidate) => normalize(candidate) === normalize(tag))) {
      relevance += 12;
      addMatch(matchedOn, `tag:${tag}`);
    }
  }

  if (relevance === 0) return null;

  const tieBreakBoost =
    (wine.status === "benchmark" ? 4 : 0) +
    (wine.wouldBuyAgain === true ? 2 : 0) +
    (wine.rating ?? 0) / 100;

  return {
    score: Math.round((relevance + tieBreakBoost) * 100) / 100,
    matchedOn,
    wine,
  };
}

export function parseTasteContextRequest(value: unknown): TasteContextRequest {
  return tasteContextSchema.parse(value);
}

export function findTasteContext(
  wines: WineMemory[],
  request: TasteContextRequest,
): TasteContextResult {
  const matches = wines
    .map((wine) => scoreWine(wine, request))
    .filter((match): match is TasteContextMatch => match !== null)
    .sort(compareMatches)
    .slice(0, request.limit);

  return {
    query: request,
    totalWines: wines.length,
    matches,
  };
}
