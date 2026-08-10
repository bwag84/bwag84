# Personal Wine Taste Retriever Design

**Date:** 2026-08-10

**Status:** Approved for implementation

## Purpose

Turn the published Wine Diary into durable, queryable evidence that Bart's private GPT can use to compare new tastings, explain established preferences, and make diary-grounded recommendations. Preserve the current capture and review workflow. Do not add retailer inventory search, purchasing, a database, or an additional model/API bill in this phase.

## Product outcomes

After this phase, Bart's Wine Diary GPT can:

- Answer questions such as “What do I tend to like in red wine?” using published diary evidence.
- Retrieve relevant benchmarks, favourites, and dislikes before comparing a new tasting.
- Explain comparisons with named wines, dates, scores, buy-again choices, and links.
- Use the retrieved history when proposing a score or verdict without overriding Bart's explicit judgment.
- Continue creating a tasting draft when history retrieval is temporarily unavailable.

This phase does not claim that retailer listings are current, search shop inventories, or purchase wine.

## Architecture

GitHub Markdown remains the single source of truth. The Vercel service gains a read-only repository adapter and two authenticated endpoints alongside the existing capture endpoint:

```text
Bart's Wine Diary GPT
        |
        | Bearer-authenticated GPT Actions
        v
Vercel Wine Diary API
        |
        | GitHub API, main branch
        v
content/wine/*.md
```

- `GET /v1/taste-profile` returns deterministic aggregates, favourites, benchmarks, dislikes, and term-level evidence.
- `POST /v1/taste-context` accepts structured clues plus an optional natural-language query and returns the most relevant published wines with their review evidence.
- `POST /v1/captures` remains unchanged except that all three operations share the existing Bearer authentication policy.

No server-side LLM is introduced. The API retrieves and ranks evidence; the GPT performs the final contextual interpretation.

## Source and caching model

The repository adapter reads `content/wine/*.md` from the configured GitHub repository and base branch. It checks the base-branch commit SHA on each request. A warm Vercel function reuses the parsed catalogue when the SHA is unchanged and reloads it when a wine entry is merged.

This keeps new entries visible without a synchronization job, duplicate database, webhook, or manual indexing step. Draft pull requests are intentionally excluded until merged.

## Normalized wine memory

Each Markdown entry is parsed into a stable read model:

```ts
interface WineMemory {
  id: string;
  title: string;
  date: string;
  producer: string;
  vintage: string;
  country: string;
  region: string;
  grapes: string[];
  tags: string[];
  rating: number | null;
  ratingLabel: string | null;
  verdict: "Class" | "Pass" | "Arse" | null;
  wouldBuyAgain: boolean | null;
  status: "drunk" | "benchmark";
  firstImpression: string;
  whatINoticed: string;
  verdictText: string;
  context: string | null;
  url: string;
}
```

Legacy values are preserved without invention. For example, `91*` produces `rating: 91` and `ratingLabel: "91*"`; missing verdicts remain `null`. Existing prose is split by known section headings when available and remains searchable as combined text.

## Taste profile

The profile is computed from evidence rather than generated prose. It contains:

- Total published wines, rated wines, and buy-again counts.
- Average ratings overall and by buy-again choice when evidence exists.
- Benchmark wines.
- Highest-rated buy-again wines as favourites.
- Explicit buy-again “No” wines as dislikes.
- Grapes, regions, countries, and tags with occurrence counts, buy-again counts, and average ratings.

Term evidence must include counts and supporting wine references so the GPT can distinguish a repeated pattern from a single tasting. The API never labels a term “liked” or “disliked” on one example alone.

## Context retrieval and ranking

`POST /v1/taste-context` accepts:

```json
{
  "query": "full-bodied red for steak with dark fruit and oak",
  "grapes": ["Cabernet Sauvignon"],
  "country": "France",
  "region": "Pays d’Oc",
  "tags": ["red"],
  "limit": 5
}
```

All fields are optional except that at least one searchable clue must be present. Limits are integers from 1 through 8 and default to 5.

Ranking is deterministic and explainable:

- Exact title or producer match ranks highest.
- Grape matches outrank region, country, and tag matches.
- Review-text token matches provide supporting relevance.
- Benchmarks and explicit buy-again wines receive small tie-breaking boosts.
- Rating is a final tie-breaker, not the primary definition of similarity.

Each result includes `matchedOn`, a numeric relevance score, and the complete normalized wine memory. No opaque embedding score is required at the current diary size.

## GPT behaviour

The Action schema adds `getTasteProfile` and `getTasteContext`. GPT instructions require the following behaviour:

- For general questions about Bart's preferences, call `getTasteProfile` before answering.
- Before comparing a new wine or proposing a score/verdict, call `getTasteContext` with the identified wine facts and tasting language.
- Name the supporting diary entries and distinguish repeated patterns from one-off evidence.
- Treat historical comparison as guidance. Bart's current explicit score, verdict, and buy-again choice remain authoritative.
- Do not insert a historical comparison into the public review unless Bart supplied or explicitly approves that prose.
- If retrieval fails, say the history is temporarily unavailable and continue the capture workflow without fabricating a comparison.

## Authentication and privacy

Both read endpoints use the same private Bearer key as the capture endpoint. The underlying wine entries are public, but keeping one authentication policy reduces abuse and avoids an accidental future exposure if private preference fields are added.

Responses contain only published Wine Diary data. Vercel continues to hold the GitHub token; the custom GPT never receives it.

## Errors

- `400 INVALID_TASTE_QUERY`: no searchable clue, invalid limit, or malformed input.
- `401 UNAUTHORIZED`: missing or incorrect Action key.
- `405 METHOD_NOT_ALLOWED`: wrong HTTP method.
- `502 HISTORY_UNAVAILABLE`: GitHub or repository parsing could not provide a trustworthy catalogue.

Public errors do not include repository tokens, authorization headers, raw upstream responses, or stack traces.

## Testing and release

Implementation uses strict test-first development:

- Parser tests cover current and legacy Markdown shapes, including `91*` and missing fields.
- Profile tests assert hand-calculated aggregates and evidence counts.
- Retrieval tests assert ranking order, explanations, limits, and validation.
- Repository tests cover GitHub loading, branch-SHA caching, and safe failure mapping.
- Route tests cover authentication, methods, response contracts, and error redaction.
- OpenAPI tests validate all three operations and quoted string enums.
- Existing capture, image, publisher, Hugo, and deployment tests remain green.

Release order:

1. Merge and deploy the backward-compatible Vercel API.
2. Smoke-test unauthenticated rejection and production health.
3. Update the private GPT's Action schema and instructions.
4. Run acceptance prompts against published diary evidence.

## Acceptance examples

The connected GPT must be able to answer these with named evidence:

- “What red-wine characteristics do I repeatedly enjoy?”
- “Which of my benchmark wines is closest to this Cabernet?”
- “What have I disliked, and is the evidence repeated or only one bottle?”
- “Compare this new southern French red with wines I already rated.”

It must not claim retailer availability or infer a stable preference from a single diary entry.

## Future phase

After the retriever is reliable, add retailer-aware recommendations. That phase will take a meal, budget, retailer, and location; fetch current candidates; rank them against this taste profile; cite current product links and timestamps; and clearly distinguish a listing from confirmed local stock.
