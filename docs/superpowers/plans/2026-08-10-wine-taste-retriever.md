# Personal Wine Taste Retriever Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Bart's private Wine Diary GPT authenticated, deterministic access to his published wine history so it can ground comparisons and preference summaries in named diary evidence.

**Architecture:** Keep the published Hugo Markdown files in GitHub as the only durable taste record. A read-only catalogue gateway loads those files from the configured base branch, caches the normalized catalogue by Git commit SHA, and feeds pure TypeScript functions that build a taste profile or rank relevant past wines. Two authenticated Vercel endpoints expose those results to the existing GPT Action without changing the review-before-publish capture path.

**Tech Stack:** TypeScript 6, Vitest 4, Zod 4, YAML 2, Octokit 22, Vercel Functions, OpenAPI 3.1, Hugo Markdown

## Global Constraints

- `content/wine/*.md` on `GITHUB_BASE_BRANCH` remains the single source of truth; do not add a database, vector store, or generated taste-state file.
- Retrieval is read-only and uses the existing `CAPTURE_API_KEY` Bearer credential.
- Existing `POST /v1/captures` behavior, preview gate, draft pull request, and idempotency remain unchanged.
- Unknown legacy metadata is represented as `null` or an empty array; never infer missing wine facts.
- Parse legacy ratings such as `91*` as `rating: 91` and preserve the display value as `ratingLabel: "91*"`.
- The service performs no server-side LLM calls and adds no OpenAI API cost.
- Taste claims must expose named diary evidence and distinguish a repeated pattern from one example.
- Retrieval failure must not prevent Bart from drafting or publishing a new tasting.
- No retailer availability, live inventory, purchase flow, or embeddings are included in this phase.

---

## File Map

- `services/wine-diary-api/src/wine-memory.ts` — normalized wine model plus front matter and review-section parser.
- `services/wine-diary-api/src/taste-profile.ts` — deterministic aggregate profile and evidence calculations.
- `services/wine-diary-api/src/taste-context.ts` — request validation and relevance ranking for a new wine or question.
- `services/wine-diary-api/src/catalogue.ts` — read-only GitHub source, commit-SHA cache, and catalogue loader.
- `services/wine-diary-api/src/read-app.ts` — authenticated HTTP handlers and public error mapping for the two read operations.
- `services/wine-diary-api/api/v1/taste-profile.ts` — Vercel adapter for `GET /v1/taste-profile`.
- `services/wine-diary-api/api/v1/taste-context.ts` — Vercel adapter for `POST /v1/taste-context`.
- `services/wine-diary-api/vercel.json` — public rewrites and function-duration configuration.
- `integrations/chatgpt-wine-diary/action.openapi.yaml` — GPT Action read-operation contracts.
- `integrations/chatgpt-wine-diary/instructions.md` — rules for when and how the GPT consults history.
- `docs/WINE_DIARY_CAPTURE_SETUP.md` — operating and smoke-test instructions for the expanded integration.

### Task 1: Normalize Published Wine Markdown

**Files:**
- Create: `services/wine-diary-api/src/wine-memory.ts`
- Test: `services/wine-diary-api/tests/wine-memory.test.ts`

**Interfaces:**
- Consumes: `{ path: string; markdown: string }` values loaded by the catalogue layer.
- Produces: `parseWineMemory(input: PublishedWineFile, siteOrigin?: string): WineMemory | null` and `parseWineCatalogue(files: PublishedWineFile[], siteOrigin?: string): WineMemory[]`.

- [ ] **Step 1: Write failing parser tests for current and legacy entries**

```ts
import { describe, expect, it } from "vitest";
import { parseWineMemory } from "../src/wine-memory.js";

describe("parseWineMemory", () => {
  it("normalizes a structured tasting without losing Bart's prose", () => {
    const wine = parseWineMemory({
      path: "content/wine/2026-08-07-dumanet-cabernet-sauvignon.md",
      markdown: `---
title: Dumanet Cabernet Sauvignon
date: 2026-08-07
slug: dumanet-cabernet-sauvignon
producer: Dumanet
vintage: ""
country: France
region: Pays d’Oc, Southern France
grapes: [Cabernet Sauvignon]
rating: "89"
verdict: Pass
would_buy_again: "Yes"
buy_again: true
status: drunk
tags: [Cabernet Sauvignon, budget wine]
---
## First impression

Really delicious.

## What I noticed

Dark cherry and a hint of spice.

## Verdict

A definite Pass.

## Context

About €7 for the bottle.
`,
    });

    expect(wine).toMatchObject({
      id: "2026-08-07-dumanet-cabernet-sauvignon",
      rating: 89,
      ratingLabel: "89",
      verdict: "Pass",
      wouldBuyAgain: true,
      vintage: null,
      firstImpression: "Really delicious.",
      whatINoticed: "Dark cherry and a hint of spice.",
      context: "About €7 for the bottle.",
      url: "https://bartwagener.com/wine/2026/dumanet-cabernet-sauvignon/",
    });
  });

  it("keeps qualified ratings and leaves absent legacy fields unknown", () => {
    const wine = parseWineMemory({
      path: "content/wine/2026-07-21-gilbert-picq-chablis.md",
      markdown: `---
title: Gilbert Picq & ses Fils Chablis
date: 2026-07-21
slug: gilbert-picq-chablis
producer: Domaine Gilbert Picq & ses Fils
country: France
region: Chablis
grapes: [Chardonnay]
rating: "91*"
would_buy_again: "Yes"
buy_again: true
status: drunk
tags: [white, Chablis]
---
## First impression

Precise and mineral.

## What I tasted

Fresh citrus.

## Verdict

The asterisk reflects context.
`,
    });

    expect(wine).toMatchObject({
      rating: 91,
      ratingLabel: "91*",
      verdict: null,
      vintage: null,
      whatINoticed: "Fresh citrus.",
    });
  });

  it("parses benchmark prose and skips the section index", () => {
    expect(parseWineMemory({ path: "content/wine/_index.md", markdown: "---\ntitle: Wine\n---" })).toBeNull();
    const wine = parseWineMemory({
      path: "content/wine/2026-07-10-lagassant-rouge.md",
      markdown: `---
title: L’Agassant Rouge 2022
date: 2026-07-10
slug: lagassant-rouge
producer: L’Agassant
vintage: "2022"
country: France
region: Bordeaux
grapes: [Merlot, Cabernet Sauvignon]
would_buy_again: "Yes"
buy_again: true
status: benchmark
tags: [benchmark, red, Bordeaux]
---
## Why it belongs here

Soft, generous and reliable.

## What it says about my taste

I like warmth without jamminess.
`,
    });
    expect(wine).toMatchObject({
      status: "benchmark",
      rating: null,
      firstImpression: "Soft, generous and reliable.",
      whatINoticed: "I like warmth without jamminess.",
    });
  });
});
```

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `npm --prefix services/wine-diary-api test -- wine-memory.test.ts`

Expected: FAIL because `../src/wine-memory.js` does not exist.

- [ ] **Step 3: Implement the normalized model and parser**

```ts
export interface PublishedWineFile { path: string; markdown: string }
export interface WineMemory {
  id: string;
  title: string;
  date: string;
  producer: string | null;
  vintage: string | null;
  country: string | null;
  region: string | null;
  grapes: string[];
  tags: string[];
  rating: number | null;
  ratingLabel: string | null;
  verdict: "Class" | "Pass" | "Arse" | null;
  wouldBuyAgain: boolean | null;
  status: "drunk" | "benchmark";
  firstImpression: string | null;
  whatINoticed: string | null;
  verdictText: string | null;
  context: string | null;
  url: string;
}

export function parseWineMemory(
  input: PublishedWineFile,
  siteOrigin = "https://bartwagener.com",
): WineMemory | null;

export function parseWineCatalogue(
  files: PublishedWineFile[],
  siteOrigin = "https://bartwagener.com",
): WineMemory[];
```

Use `YAML.parse` for the delimited front matter, coerce scalar values rather than trusting their runtime type, accept both `What I noticed` and `What I tasted`, map benchmark headings to the two prose fields, and build the public URL from `date.slice(0, 4)` plus `slug`. Sort the catalogue newest first with `id` as a stable tie-breaker.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm --prefix services/wine-diary-api test -- wine-memory.test.ts && npm --prefix services/wine-diary-api run typecheck`

Expected: all parser tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the parser**

```bash
git add services/wine-diary-api/src/wine-memory.ts services/wine-diary-api/tests/wine-memory.test.ts
git commit -m "feat: normalize published wine memories"
```

### Task 2: Build a Deterministic Taste Profile

**Files:**
- Create: `services/wine-diary-api/src/taste-profile.ts`
- Test: `services/wine-diary-api/tests/taste-profile.test.ts`

**Interfaces:**
- Consumes: `WineMemory[]` from `parseWineCatalogue`.
- Produces: `buildTasteProfile(wines: WineMemory[]): TasteProfile`.

- [ ] **Step 1: Write failing aggregate and evidence tests**

```ts
import { describe, expect, it } from "vitest";
import { buildTasteProfile } from "../src/taste-profile.js";
import type { WineMemory } from "../src/wine-memory.js";

const wine = (overrides: Partial<WineMemory>): WineMemory => ({
  id: "wine", title: "Wine", date: "2026-01-01", producer: null,
  vintage: null, country: null, region: null, grapes: [], tags: [],
  rating: null, ratingLabel: null, verdict: null, wouldBuyAgain: null,
  status: "drunk", firstImpression: null, whatINoticed: null,
  verdictText: null, context: null, url: "https://example.test/wine", ...overrides,
});

describe("buildTasteProfile", () => {
  it("counts known evidence without treating unknown values as negative", () => {
    const profile = buildTasteProfile([
      wine({ id: "a", rating: 89, wouldBuyAgain: true, grapes: ["Cabernet Sauvignon"], country: "France" }),
      wine({ id: "b", rating: 85, wouldBuyAgain: true, grapes: ["Primitivo"], country: "Italy" }),
      wine({ id: "c", rating: 80, wouldBuyAgain: false, grapes: ["Verdejo"], country: "Spain" }),
      wine({ id: "d", status: "benchmark", grapes: ["Cabernet Sauvignon"] }),
    ]);

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
  });

  it("marks evidence as repeated only when at least two wines support it", () => {
    const profile = buildTasteProfile([
      wine({ id: "a", rating: 89, wouldBuyAgain: true, grapes: ["Cabernet Sauvignon"] }),
      wine({ id: "b", status: "benchmark", wouldBuyAgain: true, grapes: ["Cabernet Sauvignon"] }),
      wine({ id: "c", rating: 91, wouldBuyAgain: true, grapes: ["Chardonnay"] }),
    ]);
    const cabernet = profile.evidence.grapes.find((item) => item.term === "Cabernet Sauvignon");
    const chardonnay = profile.evidence.grapes.find((item) => item.term === "Chardonnay");
    expect(cabernet).toMatchObject({ count: 2, buyAgainYes: 2, repeated: true, wineIds: ["a", "b"] });
    expect(chardonnay).toMatchObject({ count: 1, repeated: false, wineIds: ["c"] });
  });
});
```

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `npm --prefix services/wine-diary-api test -- taste-profile.test.ts`

Expected: FAIL because `../src/taste-profile.js` does not exist.

- [ ] **Step 3: Implement profile types, stable sorting, and one-decimal averages**

```ts
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

export function buildTasteProfile(wines: WineMemory[]): TasteProfile;
```

Favorites are known buy-again wines sorted by rating descending, then date descending; dislikes are known `wouldBuyAgain: false` wines sorted the same way. Evidence arrays are sorted by count descending and term ascending, with `repeated: count >= 2`.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm --prefix services/wine-diary-api test -- taste-profile.test.ts && npm --prefix services/wine-diary-api run typecheck`

Expected: all profile tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the taste profile**

```bash
git add services/wine-diary-api/src/taste-profile.ts services/wine-diary-api/tests/taste-profile.test.ts
git commit -m "feat: derive personal wine taste profile"
```

### Task 3: Rank Relevant Personal Taste Context

**Files:**
- Create: `services/wine-diary-api/src/taste-context.ts`
- Test: `services/wine-diary-api/tests/taste-context.test.ts`

**Interfaces:**
- Consumes: `WineMemory[]` and an unknown JSON body.
- Produces: `parseTasteContextRequest(value: unknown): TasteContextRequest` and `findTasteContext(wines: WineMemory[], request: TasteContextRequest): TasteContextResult`.

- [ ] **Step 1: Write failing request-validation and ranking tests**

```ts
import { describe, expect, it } from "vitest";
import { findTasteContext, parseTasteContextRequest } from "../src/taste-context.js";
import type { WineMemory } from "../src/wine-memory.js";

const wine = (overrides: Partial<WineMemory>): WineMemory => ({
  id: "wine", title: "Wine", date: "2026-01-01", producer: null,
  vintage: null, country: null, region: null, grapes: [], tags: [],
  rating: null, ratingLabel: null, verdict: null, wouldBuyAgain: null,
  status: "drunk", firstImpression: null, whatINoticed: null,
  verdictText: null, context: null, url: "https://example.test/wine", ...overrides,
});

describe("taste context", () => {
  it("requires at least one non-empty clue and defaults the limit", () => {
    expect(() => parseTasteContextRequest({})).toThrow();
    expect(parseTasteContextRequest({ grapes: ["Cabernet Sauvignon"] })).toEqual({
      grapes: ["Cabernet Sauvignon"],
      tags: [],
      limit: 5,
    });
  });

  it("ranks exact identity ahead of grape and prose matches and explains each match", () => {
    const wines = [
      wine({ id: "identity", title: "Dumanet Cabernet Sauvignon", producer: "Dumanet", grapes: ["Cabernet Sauvignon"], rating: 89 }),
      wine({ id: "grape", title: "Bordeaux", grapes: ["Cabernet Sauvignon"], rating: 92 }),
      wine({ id: "prose", title: "Other", whatINoticed: "Cabernet-like dark cherry", rating: 95 }),
    ];
    const result = findTasteContext(wines, {
      query: "Dumanet Cabernet Sauvignon",
      grapes: ["Cabernet Sauvignon"],
      tags: [],
      limit: 3,
    });
    expect(result.matches.map((match) => match.wine.id)).toEqual(["identity", "grape", "prose"]);
    expect(result.matches[0]?.matchedOn).toEqual(expect.arrayContaining(["title", "producer", "grape:Cabernet Sauvignon"]));
  });

  it("uses benchmark, buy-again, and rating only as small tie breakers", () => {
    const result = findTasteContext([
      wine({ id: "ordinary", tags: ["red"], rating: 90, wouldBuyAgain: false }),
      wine({ id: "benchmark", tags: ["red"], rating: 85, wouldBuyAgain: true, status: "benchmark" }),
    ], { tags: ["red"], grapes: [], limit: 2 });
    expect(result.matches[0]?.wine.id).toBe("benchmark");
  });
});
```

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `npm --prefix services/wine-diary-api test -- taste-context.test.ts`

Expected: FAIL because `../src/taste-context.js` does not exist.

- [ ] **Step 3: Implement the Zod request schema and deterministic scoring**

```ts
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
```

Normalize matching with Unicode NFKD, lower-case, diacritic removal, punctuation-to-spaces, and collapsed whitespace. Apply fixed weights: exact normalized title `100`, exact producer `80`, query tokens in title/producer `12` each, grape `35`, region `24`, country `16`, tag `12`, and review token `2` capped at `12`. Add tie-break boosts of `4` for a benchmark, `2` for known buy-again, and `rating / 100` when rated. Exclude zero-score wines, sort score descending then rating and date descending, and return at most `limit` matches.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm --prefix services/wine-diary-api test -- taste-context.test.ts && npm --prefix services/wine-diary-api run typecheck`

Expected: all context tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the retriever**

```bash
git add services/wine-diary-api/src/taste-context.ts services/wine-diary-api/tests/taste-context.test.ts
git commit -m "feat: retrieve relevant personal wine context"
```

### Task 4: Load and Cache the GitHub Wine Catalogue

**Files:**
- Create: `services/wine-diary-api/src/catalogue.ts`
- Test: `services/wine-diary-api/tests/catalogue.test.ts`

**Interfaces:**
- Consumes: the existing immutable `AppConfig["github"]` values and `PublishedWineFile` parser input.
- Produces: `GitHubWineCatalogueSource`, `WineCatalogueReader`, and `createWineCatalogueReader(source, siteOrigin?)`.

- [ ] **Step 1: Write failing tests for GitHub loading, SHA caching, and safe failures**

```ts
import { describe, expect, it, vi } from "vitest";
import { createWineCatalogueReader, GitHubWineCatalogueSource } from "../src/catalogue.js";

describe("wine catalogue", () => {
  it("reuses parsed wine memories while the base commit SHA is unchanged", async () => {
    const source = {
      getBaseCommitSha: vi.fn().mockResolvedValue("sha-1"),
      readPublishedWineFiles: vi.fn().mockResolvedValue([{ path: "content/wine/2026-01-01-one.md", markdown: "---\ntitle: One\ndate: 2026-01-01\nslug: one\nstatus: drunk\n---\n" }]),
    };
    const reader = createWineCatalogueReader(source);
    const first = await reader.read();
    const second = await reader.read();
    expect(second).toBe(first);
    expect(source.readPublishedWineFiles).toHaveBeenCalledTimes(1);
  });

  it("reloads after the published base commit changes", async () => {
    const source = {
      getBaseCommitSha: vi.fn().mockResolvedValueOnce("sha-1").mockResolvedValueOnce("sha-2"),
      readPublishedWineFiles: vi.fn()
        .mockResolvedValueOnce([{ path: "content/wine/2026-01-01-one.md", markdown: "---\ntitle: One\ndate: 2026-01-01\nslug: one\nstatus: drunk\n---\n" }])
        .mockResolvedValueOnce([{ path: "content/wine/2026-01-02-two.md", markdown: "---\ntitle: Two\ndate: 2026-01-02\nslug: two\nstatus: drunk\n---\n" }]),
    };
    const reader = createWineCatalogueReader(source);
    expect((await reader.read())[0]?.title).toBe("One");
    expect((await reader.read())[0]?.title).toBe("Two");
  });

  it("loads only Markdown blobs directly beneath content/wine", async () => {
    const api = { git: {
      getRef: vi.fn().mockResolvedValue({ data: { object: { sha: "commit" } } }),
      getCommit: vi.fn().mockResolvedValue({ data: { tree: { sha: "tree" } } }),
      getTree: vi.fn().mockResolvedValue({ data: { tree: [
        { path: "content/wine/one.md", type: "blob", sha: "blob-one" },
        { path: "content/wine/_index.md", type: "blob", sha: "blob-index" },
        { path: "content/blog/no.md", type: "blob", sha: "blob-no" },
      ] } }),
      getBlob: vi.fn().mockResolvedValue({ data: { encoding: "base64", content: Buffer.from("---\ntitle: One\n---\n").toString("base64") } }),
    } };
    const source = new GitHubWineCatalogueSource(
      { token: "secret", owner: "bwag84", repo: "bwag84", baseBranch: "main" },
      api as never,
    );
    await expect(source.readPublishedWineFiles("commit")).resolves.toEqual([
      { path: "content/wine/one.md", markdown: "---\ntitle: One\n---\n" },
    ]);
    expect(api.git.getBlob).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `npm --prefix services/wine-diary-api test -- catalogue.test.ts`

Expected: FAIL because `../src/catalogue.js` does not exist.

- [ ] **Step 3: Implement the source boundary and warm-function cache**

```ts
export interface WineCatalogueSource {
  getBaseCommitSha(): Promise<string>;
  readPublishedWineFiles(commitSha: string): Promise<PublishedWineFile[]>;
}

export interface WineCatalogueReader {
  read(): Promise<WineMemory[]>;
}

export function createWineCatalogueReader(
  source: WineCatalogueSource,
  siteOrigin = "https://bartwagener.com",
): WineCatalogueReader;
```

`GitHubWineCatalogueSource` uses `git.getRef({ ref: "heads/<baseBranch>" })`, resolves the commit tree, recursively lists it, filters `^content/wine/[^/]+\.md$` while excluding `_index.md`, then decodes each blob. Convert GitHub/API/decoding failures to `new AppError("HISTORY_UNAVAILABLE", 502, "The published wine history is temporarily unavailable. Please retry.")` without including credentials in the message.

- [ ] **Step 4: Run focused tests and type checking**

Run: `npm --prefix services/wine-diary-api test -- catalogue.test.ts && npm --prefix services/wine-diary-api run typecheck`

Expected: all catalogue tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the catalogue layer**

```bash
git add services/wine-diary-api/src/catalogue.ts services/wine-diary-api/tests/catalogue.test.ts
git commit -m "feat: load and cache published wine catalogue"
```

### Task 5: Expose Authenticated Read Endpoints

**Files:**
- Create: `services/wine-diary-api/src/read-app.ts`
- Create: `services/wine-diary-api/api/v1/taste-profile.ts`
- Create: `services/wine-diary-api/api/v1/taste-context.ts`
- Modify: `services/wine-diary-api/vercel.json`
- Test: `services/wine-diary-api/tests/read-app.test.ts`

**Interfaces:**
- Consumes: `WineCatalogueReader`, existing `AppConfig`, `buildTasteProfile`, `parseTasteContextRequest`, and `findTasteContext`.
- Produces: `handleTasteProfile(request, dependencies?)` and `handleTasteContext(request, dependencies?)` returning Web `Response` objects.

- [ ] **Step 1: Write failing handler tests for methods, auth, success, and errors**

```ts
import { describe, expect, it, vi } from "vitest";
import { handleTasteContext, handleTasteProfile } from "../src/read-app.js";

const dependencies = (wines: never[] = []) => ({
  config: {
    captureApiKey: "secret-value",
    github: Object.freeze({ token: "github", owner: "bwag84", repo: "bwag84", baseBranch: "main" }),
  },
  catalogue: { read: vi.fn().mockResolvedValue(wines) },
});

describe("taste read handlers", () => {
  it("requires GET and Bearer auth for the profile", async () => {
    const method = await handleTasteProfile(new Request("https://example.test/v1/taste-profile", { method: "POST" }), dependencies());
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("GET");
    const unauthorized = await handleTasteProfile(new Request("https://example.test/v1/taste-profile"), dependencies());
    expect(unauthorized.status).toBe(401);
  });

  it("returns the profile with private no-store caching", async () => {
    const response = await handleTasteProfile(new Request("https://example.test/v1/taste-profile", {
      headers: { authorization: "Bearer secret-value" },
    }), dependencies());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ generatedFrom: 0 });
  });

  it("maps an empty context query to INVALID_TASTE_QUERY", async () => {
    const response = await handleTasteContext(new Request("https://example.test/v1/taste-context", {
      method: "POST",
      headers: { authorization: "Bearer secret-value", "content-type": "application/json" },
      body: "{}",
    }), dependencies());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: {
      code: "INVALID_TASTE_QUERY",
      message: "Provide at least one wine, grape, region, country, tag, or tasting clue.",
    } });
  });

  it("does not hide HISTORY_UNAVAILABLE behind an internal error", async () => {
    const deps = dependencies();
    deps.catalogue.read.mockRejectedValue(new Error("network"));
    const response = await handleTasteProfile(new Request("https://example.test/v1/taste-profile", {
      headers: { authorization: "Bearer secret-value" },
    }), deps);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "HISTORY_UNAVAILABLE" } });
  });
});
```

- [ ] **Step 2: Run the focused test and observe the missing-module failure**

Run: `npm --prefix services/wine-diary-api test -- read-app.test.ts`

Expected: FAIL because `../src/read-app.js` does not exist.

- [ ] **Step 3: Implement shared read dependencies and handlers**

```ts
export interface ReadAppDependencies {
  config: AppConfig;
  catalogue: WineCatalogueReader;
  reportAuthFailure?: (diagnostic: AuthorizationDiagnostic) => void;
}

export async function handleTasteProfile(
  request: Request,
  dependencies: ReadAppDependencies = defaultReadDependencies(),
): Promise<Response>;

export async function handleTasteContext(
  request: Request,
  dependencies: ReadAppDependencies = defaultReadDependencies(),
): Promise<Response>;
```

Use the existing constant-time `isAuthorized` and safe authorization diagnostic. Return `cache-control: private, no-store`. Map malformed JSON and `ZodError` to `INVALID_TASTE_QUERY`; map `AppError`; map any other catalogue failure to `HISTORY_UNAVAILABLE` with status `502`.

- [ ] **Step 4: Add thin Vercel adapters and route configuration**

Each adapter converts `VercelRequest` to a Web `Request`, invokes its handler, copies response headers, and sends the response text. Extend `vercel.json` with exact rewrites from `/v1/taste-profile` and `/v1/taste-context` and function entries with `maxDuration: 30`.

- [ ] **Step 5: Run read-handler tests, the entire API suite, and type checking**

Run: `npm --prefix services/wine-diary-api test -- read-app.test.ts && npm --prefix services/wine-diary-api test && npm --prefix services/wine-diary-api run typecheck`

Expected: all API tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the HTTP surface**

```bash
git add services/wine-diary-api/src/read-app.ts services/wine-diary-api/api/v1/taste-profile.ts services/wine-diary-api/api/v1/taste-context.ts services/wine-diary-api/vercel.json services/wine-diary-api/tests/read-app.test.ts
git commit -m "feat: expose private wine taste retrieval API"
```

### Task 6: Teach the GPT Action to Retrieve Personal History

**Files:**
- Modify: `integrations/chatgpt-wine-diary/action.openapi.yaml`
- Modify: `integrations/chatgpt-wine-diary/instructions.md`
- Modify: `services/wine-diary-api/tests/openapi.test.ts`

**Interfaces:**
- Consumes: the two deployed authenticated endpoints.
- Produces: Action operations `getTasteProfile` and `getTasteContext` with schemas that match the JSON returned by Tasks 2, 3, and 5.

- [ ] **Step 1: Extend the OpenAPI test first**

Add assertions that:

```ts
const profileOperation = document.paths["/v1/taste-profile"]?.get;
const contextOperation = document.paths["/v1/taste-context"]?.post;
expect(profileOperation?.operationId).toBe("getTasteProfile");
expect(profileOperation?.["x-openai-isConsequential"]).toBe(false);
expect(profileOperation?.security).toEqual([{ bearerAuth: [] }]);
expect(contextOperation?.operationId).toBe("getTasteContext");
expect(contextOperation?.["x-openai-isConsequential"]).toBe(false);
expect(contextOperation?.security).toEqual([{ bearerAuth: [] }]);
expect(document.components.schemas.TasteContextRequest).toMatchObject({
  type: "object",
  additionalProperties: false,
});
```

- [ ] **Step 2: Run the OpenAPI test and observe the contract failure**

Run: `npm --prefix services/wine-diary-api test -- openapi.test.ts`

Expected: FAIL because the two paths and retrieval schemas are absent.

- [ ] **Step 3: Add both read operations and exact response schemas**

Define:

```yaml
/v1/taste-profile:
  get:
    operationId: getTasteProfile
    x-openai-isConsequential: false
    security:
      - bearerAuth: []
/v1/taste-context:
  post:
    operationId: getTasteContext
    x-openai-isConsequential: false
    security:
      - bearerAuth: []
```

`TasteContextRequest` has optional `query`, `grapes`, `country`, `region`, and `tags`, plus optional `limit` from `1` to `8`; its description says at least one clue is required. Define reusable `WineMemory`, `TasteEvidence`, `TasteProfile`, `TasteContextMatch`, and `TasteContextResponse` components with nullable legacy fields represented by `type: [string, "null"]` or `type: [integer, "null"]`. Include `400`, `401`, `405`, and `502` responses as applicable.

- [ ] **Step 4: Add GPT retrieval rules without weakening the preview gate**

Add a `Personal taste memory` section to the instructions with these exact behavioral requirements:

- Call `getTasteProfile` for broad preference, favorite, dislike, or recurring-pattern questions.
- Call `getTasteContext` before comparing a new wine, proposing a score from history, or answering which prior bottles are closest.
- Name the past wines used as evidence and include ratings, verdicts, or buy-again values only when the endpoint supplies them.
- Say `repeated pattern` only for evidence marked `repeated: true`; otherwise say it is one example.
- Use history as context, never as a replacement for Bart's present tasting judgment.
- Do not add a historical comparison to publishable review prose unless Bart supplied or explicitly approved that prose.
- If retrieval fails, briefly state that history is unavailable and continue the capture workflow from Bart's current notes.

- [ ] **Step 5: Run schema and full API verification**

Run: `npm --prefix services/wine-diary-api test -- openapi.test.ts && npm --prefix services/wine-diary-api test && npm --prefix services/wine-diary-api run typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the GPT contract**

```bash
git add integrations/chatgpt-wine-diary/action.openapi.yaml integrations/chatgpt-wine-diary/instructions.md services/wine-diary-api/tests/openapi.test.ts
git commit -m "feat: connect wine GPT to personal taste memory"
```

### Task 7: Document, Verify, Ship, and Deploy

**Files:**
- Modify: `docs/WINE_DIARY_CAPTURE_SETUP.md`
- Modify only if verification reveals a defect: files introduced in Tasks 1–6.

**Interfaces:**
- Consumes: the complete implementation and current Vercel/GitHub deployment configuration.
- Produces: reproducible operator checks, a reviewed pull request, and a production deployment.

- [ ] **Step 1: Add retrieval operating instructions and safe smoke tests**

Document the two new endpoints, that they read only merged/published Markdown, the commit-SHA warm cache, and that no separate memory database exists. Add unauthenticated checks that expect `401`:

```bash
curl -sS -i https://wine-diary-api.vercel.app/v1/taste-profile
curl -sS -i -X POST -H 'Content-Type: application/json' -d '{"grapes":["Cabernet Sauvignon"]}' https://wine-diary-api.vercel.app/v1/taste-context
```

Add authenticated checks using the existing safe hidden shell variable entry and explicitly avoid placing the key in chat, documentation, or shell history.

- [ ] **Step 2: Run complete local verification from the repository root**

Run:

```bash
git diff --check
npm --prefix services/wine-diary-api test
npm --prefix services/wine-diary-api run typecheck
bash tests/hugo-wine-verdict.sh
npm run build
```

Expected: no whitespace errors, all API tests PASS, TypeScript exits 0, Hugo wine checks PASS, and the production Hugo build exits 0.

- [ ] **Step 3: Review the branch diff for scope and secret safety**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git grep -nE 'CAPTURE_API_KEY=|GITHUB_TOKEN=' HEAD -- . ':!docs/superpowers/specs/**' ':!docs/superpowers/plans/**'
```

Expected: only planned files changed, diff check is clean, and no credential values appear.

- [ ] **Step 4: Commit documentation, push, and create the pull request**

```bash
git add docs/WINE_DIARY_CAPTURE_SETUP.md
git commit -m "docs: explain personal wine taste retrieval"
git push -u origin codex/wine-taste-retriever
gh pr create --repo bwag84/bwag84 --base main --head codex/wine-taste-retriever --title "Add personal wine taste retriever" --body-file <prepared-body-file>
```

The pull request body summarizes the single-source-of-truth architecture, endpoints, deterministic evidence rules, tests, and the remaining one-time GPT schema paste.

- [ ] **Step 5: Wait for required GitHub checks and merge when green**

Run: `gh pr checks <number> --repo bwag84/bwag84 --watch`

Expected: required checks PASS. Then merge with the repository's accepted non-destructive merge method and confirm `origin/main` contains the merge.

- [ ] **Step 6: Deploy the merged API to Vercel and run unauthenticated smoke tests**

From `services/wine-diary-api`, run the established production deploy command for project `bartwagener-7227s-projects/wine-diary-api`, then call both public endpoints without a credential.

Expected: deployment succeeds; `GET /v1/taste-profile` and `POST /v1/taste-context` both return `401 UNAUTHORIZED`, proving the routes are live but private.

- [ ] **Step 7: Prepare the only human handoff**

Provide Bart with the updated `action.openapi.yaml` and `instructions.md` locations plus a short GPT Builder checklist: edit the existing private GPT, replace the Action schema, preserve API-key/Bearer authentication, replace instructions, save, and ask `Which wines in my diary are closest to Cabernet Sauvignon?`. No credential rotation is required.
