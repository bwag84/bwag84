# ChatGPT Wine Diary Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, photo-capable Wine Diary GPT workflow that converts a confirmed natural-language tasting into a validated Hugo entry and draft GitHub pull request.

**Architecture:** A dedicated GPT sends confirmed structured data and an optional short-lived photo reference to a Node.js Vercel Function. Focused modules validate the request, render safe Hugo Markdown, normalize the photo, and publish one atomic commit plus a draft pull request through GitHub's Git database API. Repository-side Hugo templates display the new verdict badge, and CI validates both the API and generated site.

**Tech Stack:** Node.js 24 on Vercel, TypeScript 7.0.2, Vitest 4.1.10, Zod 4.4.3, YAML 2.9.0, Sharp 0.35.3, Octokit REST 22.0.1, Hugo 0.128.0 in CI, GitHub Actions, GPT Actions OpenAPI 3.1.

## Global Constraints

- Never edit files under `themes/careercanvas/`; use Hugo overrides in `layouts/`.
- Never push captured content directly to `main`; every successful capture creates a draft pull request.
- Require explicit user confirmation in the GPT before calling the write action.
- Accept exactly `Class`, `Pass`, or `Arse` and a whole-number score from `0` through `100`.
- Keep `verdict` independent from `would_buy_again` and derive `buy_again` server-side.
- Require `First impression`, `What I noticed`, and `Verdict`; include `Context` only when meaningful text exists.
- Accept zero or one bottle photo, normalize it to WebP, and strip EXIF/GPS metadata.
- Use `Europe/Amsterdam` when the tasting date is implied as today.
- Generate all repository paths and slugs server-side; never accept a write path from the model.
- Use `capture_id` for idempotency and never overwrite an existing wine entry.
- Keep live API keys and GitHub credentials out of the repository, logs, responses, and pull requests.
- Preserve all unrelated pre-existing worktree changes and stage only task-owned files.

---

## File map

### Serverless service

- `services/wine-diary-api/package.json` — isolated runtime, test, and build dependencies.
- `services/wine-diary-api/package-lock.json` — reproducible dependency resolution.
- `services/wine-diary-api/tsconfig.json` — strict Node 24 TypeScript configuration.
- `services/wine-diary-api/vitest.config.ts` — service test discovery and coverage configuration.
- `services/wine-diary-api/vercel.json` — Vercel function routing and Node runtime configuration.
- `services/wine-diary-api/api/v1/captures.ts` — thin Vercel HTTP adapter only.
- `services/wine-diary-api/src/types.ts` — shared domain and dependency interfaces.
- `services/wine-diary-api/src/schema.ts` — Zod request schema and cross-field validation.
- `services/wine-diary-api/src/auth.ts` — constant-time bearer-token validation.
- `services/wine-diary-api/src/slug.ts` — deterministic ASCII slug and branch-safe ID helpers.
- `services/wine-diary-api/src/markdown.ts` — YAML front matter and review-body rendering.
- `services/wine-diary-api/src/image.ts` — temporary URL validation, bounded download, and WebP normalization.
- `services/wine-diary-api/src/github.ts` — Octokit-backed repository adapter.
- `services/wine-diary-api/src/publisher.ts` — collision resolution, idempotency, atomic commit, and draft PR orchestration.
- `services/wine-diary-api/src/config.ts` — environment parsing without secret logging.
- `services/wine-diary-api/src/app.ts` — authenticated application orchestration and error mapping.
- `services/wine-diary-api/tests/*.test.ts` — focused unit and integration tests.

### ChatGPT integration

- `integrations/chatgpt-wine-diary/instructions.md` — complete private GPT behavior and confirmation contract.
- `integrations/chatgpt-wine-diary/action.openapi.yaml` — one authenticated `createWineDraft` action.
- `docs/WINE_DIARY_CAPTURE_SETUP.md` — deployment, secret, GPT Builder, rotation, and mobile-use checklist.

### Hugo and CI

- `archetypes/wine.md` — new-entry front matter with `verdict` and `buy_again`.
- `layouts/wine/list.html` — conditional verdict badge on wine cards.
- `layouts/wine/single.html` — conditional verdict badge on individual entries.
- `testdata/hugo-content/wine/_index.md` — isolated test content section.
- `testdata/hugo-content/wine/class-example.md` — non-production verdict fixture.
- `tests/hugo-wine-verdict.sh` — build and rendered-badge regression test.
- `.github/workflows/validate-wine-draft.yml` — API, schema, and Hugo pull-request checks.

---

### Task 1: Service scaffold, domain types, request validation, and authentication

**Files:**
- Create: `services/wine-diary-api/package.json`
- Create: `services/wine-diary-api/package-lock.json`
- Create: `services/wine-diary-api/tsconfig.json`
- Create: `services/wine-diary-api/vitest.config.ts`
- Create: `services/wine-diary-api/src/types.ts`
- Create: `services/wine-diary-api/src/schema.ts`
- Create: `services/wine-diary-api/src/auth.ts`
- Test: `services/wine-diary-api/tests/schema.test.ts`
- Test: `services/wine-diary-api/tests/auth.test.ts`

**Interfaces:**
- Produces: `CaptureRequest`, `ValidatedCapture`, `WineInput`, `ReviewInput`, `OpenAIFileRef`, and `AppError` in `src/types.ts`.
- Produces: `parseCaptureRequest(value: unknown, now?: Date): ValidatedCapture` in `src/schema.ts`.
- Produces: `isAuthorized(header: string | undefined, expectedToken: string): boolean` in `src/auth.ts`.
- Consumes: no project-local interfaces.

- [ ] **Step 1: Create the service manifest and strict TypeScript/test configuration**

Use this manifest, then run `npm install` from `services/wine-diary-api` so npm writes the lockfile:

```json
{
  "name": "wine-diary-api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20 <25" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "@octokit/rest": "22.0.1",
    "sharp": "0.35.3",
    "yaml": "2.9.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "^24.10.0",
    "@vercel/node": "5.9.7",
    "typescript": "7.0.2",
    "vitest": "4.1.10"
  }
}
```

Set `module` and `moduleResolution` to `NodeNext`, `target` to `ES2023`, `strict` to `true`, `noUncheckedIndexedAccess` to `true`, and include `api`, `src`, and `tests` in `tsconfig.json`. Configure Vitest for the Node environment and `tests/**/*.test.ts`.

- [ ] **Step 2: Write failing schema tests for a valid capture and every contract boundary**

Create a reusable valid object and explicit tests for verdict enum, score integrality/range, future date, buy-again enum, zero/one file, missing required review sections, unknown factual values as empty strings/lists, and unknown top-level keys:

```ts
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
    tags: ["white", "Alsace"]
  },
  review: {
    first_impression: "Aromatic and generous.",
    what_i_noticed: "Rose, lychee and spice.",
    verdict: "84/100. A Pass in the right setting.",
    context: "Excellent with white fish but medicinal on its own."
  },
  openaiFileIdRefs: []
};

expect(parseCaptureRequest(validCapture, new Date("2026-08-08T12:00:00Z")).wine.verdict)
  .toBe("Pass");
expect(() => parseCaptureRequest({ ...validCapture, wine: { ...validCapture.wine, rating: 84.5 } }))
  .toThrow();
```

- [ ] **Step 3: Run the schema test to verify it fails**

Run: `npm test -- tests/schema.test.ts` from `services/wine-diary-api`
Expected: FAIL because `src/schema.ts` and its exports do not exist.

- [ ] **Step 4: Implement exact domain types and strict Zod parsing**

Define literal unions and derived values explicitly:

```ts
export type Verdict = "Class" | "Pass" | "Arse";
export type BuyAgain = "Yes" | "No";

export interface ValidatedCapture {
  captureId: string;
  wine: WineInput & { buyAgain: boolean };
  review: ReviewInput;
  file: OpenAIFileRef | null;
}
```

Use `.strict()` objects, `.int().min(0).max(100)`, `.max(1)` for files, ISO date validation, and `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" })` to reject dates later than the Amsterdam calendar date represented by `now`. Trim all strings and cap prose at 6,000 characters per section.

- [ ] **Step 5: Run schema tests and confirm they pass**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS for every valid and invalid boundary case.

- [ ] **Step 6: Write failing constant-time authentication tests**

Cover missing, malformed, wrong-length, wrong-value, and correct Bearer headers:

```ts
expect(isAuthorized(undefined, "secret-value")).toBe(false);
expect(isAuthorized("Basic secret-value", "secret-value")).toBe(false);
expect(isAuthorized("Bearer wrong-value", "secret-value")).toBe(false);
expect(isAuthorized("Bearer secret-value", "secret-value")).toBe(true);
```

- [ ] **Step 7: Run the authentication test to verify it fails**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL because `isAuthorized` does not exist.

- [ ] **Step 8: Implement constant-time bearer validation**

Parse exactly one `Bearer` value, convert both values to `Buffer`, reject unequal byte lengths before calling `timingSafeEqual`, and never return or log the token.

- [ ] **Step 9: Run all Task 1 checks**

Run: `npm test && npm run typecheck`
Expected: all schema/auth tests PASS and TypeScript reports no errors.

- [ ] **Step 10: Commit Task 1**

```bash
git add services/wine-diary-api
git commit -m "feat: validate wine diary capture requests"
```

---

### Task 2: Server-controlled slugs and Hugo Markdown rendering

**Files:**
- Create: `services/wine-diary-api/src/slug.ts`
- Create: `services/wine-diary-api/src/markdown.ts`
- Test: `services/wine-diary-api/tests/slug.test.ts`
- Test: `services/wine-diary-api/tests/markdown.test.ts`

**Interfaces:**
- Consumes: `ValidatedCapture` from `src/types.ts`.
- Produces: `slugifyWineTitle(title: string): string`, `captureIdSuffix(captureId: string): string`, and `withNumericSuffix(slug: string, ordinal: number): string`.
- Produces: `renderWineMarkdown(capture: ValidatedCapture, slug: string, imagePath: string | null): string`.
- Produces: `contentPath(date: string, slug: string): string` and `imagePath(date: string, slug: string): string`.

- [ ] **Step 1: Write failing slug tests**

Cover Unicode transliteration, apostrophes, repeated punctuation, empty titles, path characters, and numeric collision suffixes:

```ts
expect(slugifyWineTitle("Viña Oropéndola Verdejo 2022")).toBe("vina-oropendola-verdejo-2022");
expect(slugifyWineTitle("L’Agassant / Rouge")).toBe("lagassant-rouge");
expect(withNumericSuffix("example-wine", 1)).toBe("example-wine");
expect(withNumericSuffix("example-wine", 3)).toBe("example-wine-3");
expect(() => slugifyWineTitle("///")).toThrow();
```

- [ ] **Step 2: Run slug tests to verify failure**

Run: `npm test -- tests/slug.test.ts`
Expected: FAIL because `src/slug.ts` does not exist.

- [ ] **Step 3: Implement deterministic path-safe slug helpers**

Use Unicode NFKD normalization, remove combining marks, normalize curly apostrophes, replace non-alphanumeric runs with one hyphen, trim hyphens, enforce a 72-character maximum, and reject an empty result. `captureIdSuffix` must return the first twelve lowercase hexadecimal characters of `createHash("sha256").update(captureId).digest("hex")`, preventing raw capture IDs from appearing in branch names and making short-prefix collisions impractical.

- [ ] **Step 4: Run slug tests and confirm they pass**

Run: `npm test -- tests/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing Markdown rendering tests**

Assert exact YAML values, derived `buy_again`, optional `featured_image`, required heading order, conditional `Context`, HTML escaping, and absence of model-controlled paths:

```ts
const markdown = renderWineMarkdown(capture, "example-wine-2024", "/images/wine/2026-08-08-example-wine-2024.webp");
expect(markdown).toContain('verdict: "Pass"');
expect(markdown).toContain("buy_again: false");
expect(markdown).toContain("## First impression");
expect(markdown.indexOf("## What I noticed")).toBeGreaterThan(markdown.indexOf("## First impression"));
expect(markdown).toContain("## Context");
expect(markdown).not.toContain("<script>");
```

- [ ] **Step 6: Run Markdown tests to verify failure**

Run: `npm test -- tests/markdown.test.ts`
Expected: FAIL because `src/markdown.ts` does not exist.

- [ ] **Step 7: Implement YAML and Markdown rendering**

Use the `yaml` package to serialize a plain front-matter object in the exact field order from the design. Convert `<` and `>` in prose to `&lt;` and `&gt;`, normalize CRLF to LF, trim excess blank lines, and render `Context` only for non-empty confirmed text. Derive paths only through these functions:

```ts
export const contentPath = (date: string, slug: string) => `content/wine/${date}-${slug}.md`;
export const imagePath = (date: string, slug: string) => `static/images/wine/${date}-${slug}.webp`;
```

- [ ] **Step 8: Run Task 2 checks**

Run: `npm test -- tests/slug.test.ts tests/markdown.test.ts && npm run typecheck`
Expected: PASS with no type errors.

- [ ] **Step 9: Commit Task 2**

```bash
git add services/wine-diary-api/src services/wine-diary-api/tests
git commit -m "feat: render safe Hugo wine entries"
```

---

### Task 3: Safe temporary-photo download and WebP normalization

**Files:**
- Create: `services/wine-diary-api/src/image.ts`
- Test: `services/wine-diary-api/tests/image.test.ts`

**Interfaces:**
- Consumes: `OpenAIFileRef` from `src/types.ts`.
- Produces: `normalizeBottlePhoto(file: OpenAIFileRef, options?: ImageOptions): Promise<Buffer>`.
- Produces: `ImageOptions` with `maxBytes`, `maxDimension`, `quality`, `timeoutMs`, `fetchImpl`, and `allowedHostSuffixes`.

- [ ] **Step 1: Write failing photo tests with in-memory Sharp fixtures**

Generate JPEG/PNG buffers inside the tests and stub `fetchImpl`; do not commit binary fixtures. Cover allowed HTTPS host, rejected HTTP URL, rejected non-OpenAI host, declared and actual oversize, unsupported MIME type, fetch timeout/error, orientation normalization, maximum dimensions, WebP output, and stripped metadata.

```ts
const source = await sharp({
  create: { width: 2400, height: 1200, channels: 3, background: "#7f1d1d" }
}).jpeg().withMetadata({ orientation: 6 }).toBuffer();

const output = await normalizeBottlePhoto(fileRef, {
  fetchImpl: async () => new Response(source, { headers: { "content-type": "image/jpeg" } }),
  allowedHostSuffixes: [".oaiusercontent.com"]
});
const metadata = await sharp(output).metadata();
expect(metadata.format).toBe("webp");
expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1600);
expect(metadata.exif).toBeUndefined();
```

- [ ] **Step 2: Run image tests to verify failure**

Run: `npm test -- tests/image.test.ts`
Expected: FAIL because `src/image.ts` does not exist.

- [ ] **Step 3: Implement bounded download and normalization**

Defaults must be 20 MiB, 1600 pixels, WebP quality 82, and a 12-second download timeout. Validate `mime_type` against JPEG, PNG, WebP, and HEIC/HEIF. Require HTTPS and a configured OpenAI-owned host suffix. Follow redirects only when every final URL remains HTTPS. Check `content-length` when present and the final `ArrayBuffer.byteLength` always. Use `sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()` without `withMetadata()`.

- [ ] **Step 4: Run image tests and typecheck**

Run: `npm test -- tests/image.test.ts && npm run typecheck`
Expected: PASS, with the WebP fixture reporting no EXIF block.

- [ ] **Step 5: Commit Task 3**

```bash
git add services/wine-diary-api/src/image.ts services/wine-diary-api/tests/image.test.ts
git commit -m "feat: normalize wine bottle photos"
```

---

### Task 4: GitHub adapter, collision resolution, idempotency, atomic commit, and draft pull request

**Files:**
- Create: `services/wine-diary-api/src/github.ts`
- Create: `services/wine-diary-api/src/publisher.ts`
- Test: `services/wine-diary-api/tests/publisher.test.ts`
- Test: `services/wine-diary-api/tests/github.test.ts`

**Interfaces:**
- Consumes: rendered Markdown from `renderWineMarkdown`, normalized image `Buffer | null`, slug helpers, and `ValidatedCapture`.
- Produces: `RepositoryGateway` interface in `src/types.ts` with `getMainHead`, `listReservedContentPaths`, `findDraftByCaptureId`, `getBranchCaptureId`, `createAtomicCommitBranch`, and `createDraftPullRequest`.
- Produces: `OctokitRepositoryGateway` implementing `RepositoryGateway`.
- Produces: `publishCapture(input: PublishInput, gateway: RepositoryGateway): Promise<PublishResult>`.

- [ ] **Step 1: Write failing publisher orchestration tests against a fake gateway**

Cover a fresh capture, replay returning the same PR, dated-slug collision choosing `-2`, simultaneous open-PR path reservation choosing the next suffix, branch-created/PR-failed retry, no-photo capture, and proof that input strings cannot select paths.

```ts
const result = await publishCapture({ capture, photo: null }, gateway);
expect(result.status).toBe("created");
expect(gateway.createdBranch).toMatch(/^wine-diary\/2026-08-08-example-wine-2024-/);
expect(gateway.committedFiles.map(file => file.path)).toEqual([
  "content/wine/2026-08-08-example-wine-2024.md"
]);
expect(gateway.pullRequestDraft).toBe(true);
```

- [ ] **Step 2: Run publisher tests to verify failure**

Run: `npm test -- tests/publisher.test.ts`
Expected: FAIL because publisher interfaces and implementation do not exist.

- [ ] **Step 3: Implement deterministic publisher orchestration**

The algorithm must run in this order:

```ts
const existing = await gateway.findDraftByCaptureId(capture.captureId);
if (existing) return { status: "already_exists", ...existing };

const reserved = await gateway.listReservedContentPaths();
const slug = firstAvailableSlug(slugifyWineTitle(capture.wine.title), capture.wine.date, reserved);
const branch = `wine-diary/${capture.wine.date}-${slug}-${captureIdSuffix(capture.captureId)}`;
const files = buildRepositoryFiles(capture, slug, photo);

const branchCaptureId = await gateway.getBranchCaptureId(branch);
if (branchCaptureId === null) {
  await gateway.createAtomicCommitBranch(
    branch,
    files,
    `Add wine note: ${capture.wine.title}\n\nWine-Capture-ID: ${capture.captureId}`
  );
} else if (branchCaptureId !== capture.captureId) {
  throw new AppError("BRANCH_COLLISION", 409, "The generated draft branch is already in use.");
}
const pullRequest = await gateway.createDraftPullRequest(branch, capture, files);
return { status: "created", pullRequestUrl: pullRequest.url, contentPath: files[0].path, imagePath: files[1]?.path ?? null };
```

Embed `<!-- wine-capture-id: CAPTURE_ID -->` in the pull-request body and escape table pipes/newlines in summary values.

- [ ] **Step 4: Run publisher orchestration tests**

Run: `npm test -- tests/publisher.test.ts`
Expected: PASS for fresh, replay, collision, and partial-retry cases.

- [ ] **Step 5: Write failing Octokit adapter interaction tests**

Mock Octokit methods and assert the adapter calls `git.getRef`, `git.getCommit`, `git.createBlob`, `git.createTree`, `git.createCommit`, `git.createRef`, `pulls.list`, `pulls.listFiles`, and `pulls.create({ draft: true })` with owner `bwag84`, repository `bwag84`, and base `main` from configuration rather than request data.

- [ ] **Step 6: Run adapter tests to verify failure**

Run: `npm test -- tests/github.test.ts`
Expected: FAIL until the Octokit adapter is complete.

- [ ] **Step 7: Implement the Octokit repository gateway**

Create blobs for Markdown and optional image, create one tree from the current base tree, create one commit with the `Wine-Capture-ID` trailer, and create the branch ref only after the commit object exists. `getBranchCaptureId` must return `null` for a missing branch, extract the exact trailer from an existing branch's head commit, and return an empty string when the branch exists without a valid trailer so the publisher rejects it. List open wine-diary pull requests and their files when building the reserved path set. Treat GitHub `404` as absence only in methods where absence is expected; map all other errors to a redacted `AppError` without response headers or token-bearing request data.

- [ ] **Step 8: Run Task 4 checks**

Run: `npm test -- tests/publisher.test.ts tests/github.test.ts && npm run typecheck`
Expected: PASS with one atomic commit and draft PR interaction verified.

- [ ] **Step 9: Commit Task 4**

```bash
git add services/wine-diary-api/src services/wine-diary-api/tests
git commit -m "feat: publish wine captures as draft pull requests"
```

---

### Task 5: Environment parsing, application orchestration, and Vercel HTTP adapter

**Files:**
- Create: `services/wine-diary-api/src/config.ts`
- Create: `services/wine-diary-api/src/app.ts`
- Create: `services/wine-diary-api/api/v1/captures.ts`
- Create: `services/wine-diary-api/vercel.json`
- Create: `services/wine-diary-api/.env.example`
- Test: `services/wine-diary-api/tests/config.test.ts`
- Test: `services/wine-diary-api/tests/app.test.ts`

**Interfaces:**
- Consumes: `parseCaptureRequest`, `isAuthorized`, `normalizeBottlePhoto`, `publishCapture`, and `OctokitRepositoryGateway`.
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig`.
- Produces: `handleCapture(request: Request, dependencies?: Partial<AppDependencies>): Promise<Response>`.
- Produces: default Vercel handler in `api/v1/captures.ts` that converts `VercelRequest` to a Web `Request` and writes the Web `Response` to `VercelResponse`.

- [ ] **Step 1: Write failing configuration tests**

Require non-empty `CAPTURE_API_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, and `GITHUB_BASE_BRANCH`; default owner/repository/base only in `.env.example`, not in code. Assert error messages name the missing variable but never reveal supplied values.

- [ ] **Step 2: Run configuration tests to verify failure**

Run: `npm test -- tests/config.test.ts`
Expected: FAIL because `loadConfig` does not exist.

- [ ] **Step 3: Implement strict environment parsing**

Return an immutable `AppConfig`; reject repository owner/name/base values containing separators, whitespace, or control characters. Add `services/wine-diary-api/.env.example` with key names and safe non-secret examples.

- [ ] **Step 4: Write failing application tests**

Use injected fake image and publisher dependencies. Cover `405` for non-POST, `401` for missing/wrong auth, `400` for invalid JSON/schema, `201` for a new draft, `200` for idempotent replay, `502` for redacted upstream failures, no-photo success, expired-photo error text, and JSON responses that never include the OpenAI download URL.

```ts
const response = await handleCapture(new Request("https://capture.example/v1/captures", {
  method: "POST",
  headers: { authorization: "Bearer capture-secret", "content-type": "application/json" },
  body: JSON.stringify(validCapture)
}), fakeDependencies);
expect(response.status).toBe(201);
expect(await response.json()).toMatchObject({ status: "created" });
```

- [ ] **Step 5: Run application tests to verify failure**

Run: `npm test -- tests/app.test.ts`
Expected: FAIL because `handleCapture` does not exist.

- [ ] **Step 6: Implement application orchestration and safe errors**

Read and parse JSON once, authenticate before expensive work, validate before downloading the photo, normalize the optional photo before any GitHub mutation, then publish. Return only `status`, `capture_id`, `pull_request_url`, `content_path`, and nullable `image_path`. Define stable public error codes such as `UNAUTHORIZED`, `INVALID_CAPTURE`, `PHOTO_EXPIRED`, `PHOTO_REJECTED`, and `GITHUB_UNAVAILABLE`.

- [ ] **Step 7: Implement the thin Vercel adapter and routing configuration**

Set `vercel.json` to route `/v1/captures` to `api/v1/captures.ts` and use Node.js 24. The adapter must reject bodies Vercel did not parse as JSON, forward request headers, and serialize the Web response status/headers/body without business logic.

- [ ] **Step 8: Run the complete service suite**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS and the service typechecks under strict mode.

- [ ] **Step 9: Commit Task 5**

```bash
git add services/wine-diary-api
git commit -m "feat: expose the wine capture API"
```

---

### Task 6: Private GPT instructions, Action schema, and setup checklist

**Files:**
- Create: `integrations/chatgpt-wine-diary/instructions.md`
- Create: `integrations/chatgpt-wine-diary/action.openapi.yaml`
- Create: `docs/WINE_DIARY_CAPTURE_SETUP.md`
- Test: `services/wine-diary-api/tests/openapi.test.ts`

**Interfaces:**
- Consumes: the exact `CaptureRequest` and response contract from Tasks 1 and 5.
- Produces: one GPT operation with `operationId: createWineDraft` at `POST /v1/captures`.

- [ ] **Step 1: Write a failing OpenAPI contract test**

Parse the YAML action schema with the existing `yaml` dependency and assert server URL is HTTPS, the operation ID is exact, Bearer API-key security is required, `capture_id`/`wine`/`review` are required, `openaiFileIdRefs` has `maxItems: 1`, verdict is the three-value enum, rating is integer `0..100`, and the documented success fields match the API response.

- [ ] **Step 2: Run the OpenAPI test to verify failure**

Run: `npm test -- tests/openapi.test.ts`
Expected: FAIL because the Action schema does not exist.

- [ ] **Step 3: Write the complete private GPT instructions**

The instructions must explicitly require this sequence:

1. Accept one photo plus natural brain-dump by typing or voice dictation.
2. Read label facts and preserve subjective wording.
3. Research only factual metadata that can be established confidently.
4. Ask one concise grouped follow-up for missing required information.
5. Draft the three required sections and optional `Context`.
6. Infer verdict and score without fixed score thresholds.
7. Show a readable preview with photo inclusion status.
8. Ask `Create the draft pull request?`.
9. Never call `createWineDraft` before an explicit Yes.
10. Generate one stable `capture_id` and reuse it after a retry.
11. On success, return the PR link and state that the entry is not live.
12. On `PHOTO_EXPIRED`, retain the prose and ask only for the photo again.

Include explicit prohibitions against invented tasting notes, silent field changes after confirmation, direct publication claims, and exposing Action internals or credentials.

- [ ] **Step 4: Write the Action OpenAPI 3.1 schema**

Define the production URL as an obvious replace-on-setup value, one `bearerAuth` HTTP security scheme, `x-openai-isConsequential: true`, the exact request schema including OpenAI's required `openaiFileIdRefs` name and object fields, and `200`, `201`, `400`, `401`, `409`, and `502` response shapes.

- [ ] **Step 5: Run the OpenAPI contract test**

Run: `npm test -- tests/openapi.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the deployment and private-GPT setup checklist**

Document these exact checkpoints without including live secret values:

- Confirm the private GPT is available in Bart's ChatGPT account on desktop and mobile.
- Create a fine-grained GitHub token restricted to `bwag84/bwag84` with Contents and Pull Requests write permissions.
- Generate a high-entropy capture API key locally.
- Deploy `services/wine-diary-api` as the Vercel project root using Node.js 24.
- Configure `CAPTURE_API_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER=bwag84`, `GITHUB_REPO=bwag84`, and `GITHUB_BASE_BRANCH=main` for Production and Preview.
- Replace the OpenAPI server placeholder with the deployed HTTPS origin.
- Create a private GPT, paste the instructions, import the schema, choose API-key/Bearer authentication, and store the capture API key.
- Test desktop typing, mobile photo upload plus dictation, expired-photo retry, and token rotation.
- Revoke both secrets and redeploy immediately if either is exposed.

- [ ] **Step 7: Commit Task 6**

```bash
git add integrations/chatgpt-wine-diary docs/WINE_DIARY_CAPTURE_SETUP.md services/wine-diary-api/tests/openapi.test.ts
git commit -m "docs: define the Wine Diary GPT integration"
```

---

### Task 7: Hugo verdict contract and conditional badges

**Files:**
- Modify: `archetypes/wine.md`
- Modify: `layouts/wine/list.html`
- Modify: `layouts/wine/single.html`
- Create: `testdata/hugo-content/wine/_index.md`
- Create: `testdata/hugo-content/wine/class-example.md`
- Create: `tests/hugo-wine-verdict.sh`

**Interfaces:**
- Consumes: front-matter `verdict` string from generated entries.
- Produces: conditional visible badge text on list and single views without requiring old entries to define the field.

- [ ] **Step 1: Write the failing Hugo regression script and isolated fixture**

The fixture must contain all new required front matter and a `Class` verdict. The script must build only `testdata/hugo-content` into a `mktemp -d` destination, trap cleanup of that exact directory, and assert both `/wine/index.html` and the fixture's single page contain `Class` and an accessible `Wine verdict: Class` label.

```bash
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
hugo --contentDir testdata/hugo-content --destination "$test_root/public" --cleanDestinationDir
rg -q 'Wine verdict: Class' "$test_root/public/wine/index.html"
rg -q 'Wine verdict: Class' "$test_root/public/wine/2026/class-example/index.html"
```

- [ ] **Step 2: Run the Hugo regression script to verify failure**

Run: `bash tests/hugo-wine-verdict.sh`
Expected: FAIL because the templates do not render a verdict badge.

- [ ] **Step 3: Add the new archetype fields**

Add `verdict: ""` and `buy_again: false` beside the existing rating and buy-again fields. Replace the body skeleton with the exact generated order: `## First impression`, `## What I noticed`, `## Verdict`, and `## Context`. Add an HTML comment directly below `Context` saying `Remove this section when there is no meaningful context.` so manual use of the archetype follows the same optional-section rule.

- [ ] **Step 4: Render accessible conditional badges in both layout overrides**

Use existing generated Tailwind classes only, avoiding a CSS rebuild:

```go-html-template
{{ with .Params.verdict }}
<span aria-label="Wine verdict: {{ . }}" class="inline-flex rounded-full bg-primary-lighter px-3 py-1 text-sm font-semibold text-text-primary">{{ . }}</span>
{{ end }}
```

Place the list badge beside the rating and the single-page badge in the metadata header. Historical entries without `verdict` must produce no empty badge.

- [ ] **Step 5: Run Hugo regression and production builds**

Run: `bash tests/hugo-wine-verdict.sh`
Expected: PASS for list and single badge assertions.
Run: `npm run build` from the repository root.
Expected: Hugo completes successfully with existing content.

- [ ] **Step 6: Commit Task 7**

```bash
git add archetypes/wine.md layouts/wine testdata/hugo-content tests/hugo-wine-verdict.sh
git commit -m "feat: display wine verdict badges"
```

---

### Task 8: Pull-request validation workflow and full local verification

**Files:**
- Create: `.github/workflows/validate-wine-draft.yml`
- Modify: `docs/WINE_DIARY_CAPTURE_SETUP.md`

**Interfaces:**
- Consumes: service scripts, Hugo test script, repository Node lockfile, and Hugo 0.128.0.
- Produces: required validation evidence for every pull request that changes wine content, API code, GPT integration, layouts, or the validation workflow.

- [ ] **Step 1: Add a pull-request workflow with explicit permissions and path filters**

Trigger on `pull_request` changes to `content/wine/**`, `static/images/wine/**`, `layouts/wine/**`, `archetypes/wine.md`, `services/wine-diary-api/**`, `integrations/chatgpt-wine-diary/**`, `tests/hugo-wine-verdict.sh`, `testdata/hugo-content/**`, and the workflow itself. Set top-level permissions to `contents: read`.

Create two jobs:

- `api`: checkout, setup Node 24 with npm cache keyed to the service lockfile, run `npm ci`, `npm test`, and `npm run typecheck` from the service directory.
- `hugo`: install Hugo Extended 0.128.0 exactly as production does, checkout submodules, setup Node 24 with root npm cache, run root `npm ci`, `bash tests/hugo-wine-verdict.sh`, and `npm run build`.

- [ ] **Step 2: Validate workflow syntax and path ownership locally**

Parse the workflow with the service's `yaml` package in a one-line Node command and assert the resulting value is an object. Then inspect `git diff --check` for all feature files.

Run: `node -e "import('yaml').then(async ({parse}) => { const {readFile} = await import('node:fs/promises'); const doc=parse(await readFile('../../.github/workflows/validate-wine-draft.yml','utf8')); if (!doc || typeof doc !== 'object') process.exit(1); })"` from `services/wine-diary-api`.
Expected: exit code 0.

- [ ] **Step 3: Run the complete local verification suite**

Run from `services/wine-diary-api`: `npm ci && npm test && npm run typecheck && npm run build`
Expected: all service and contract tests PASS.
Run from repository root: `npm ci && bash tests/hugo-wine-verdict.sh && npm run build`
Expected: isolated verdict rendering and production Hugo build PASS.
Run: `git diff --check`
Expected: no whitespace errors.

- [ ] **Step 4: Check secret hygiene and generated artifacts**

Run `rg -n "(github_pat_|ghp_|CAPTURE_API_KEY=.+|GITHUB_TOKEN=.+|oaiusercontent\.com/.+sig=)" services integrations docs .github` and inspect every match. Expected matches are variable names or explanatory prose only; no credential value or signed temporary URL is present. Confirm `services/wine-diary-api/node_modules` and Hugo output remain ignored and unstaged.

- [ ] **Step 5: Update setup documentation with verified commands and limitations**

Record Node 24, Vercel's 4.5 MB request-body fact not affecting URL-based photo transfer, the 20 MiB downloaded-photo limit enforced by the API, voice dictation as the supported spoken workflow, one-photo maximum, review/merge in GitHub, and exact commands that passed locally.

- [ ] **Step 6: Commit Task 8**

```bash
git add .github/workflows/validate-wine-draft.yml docs/WINE_DIARY_CAPTURE_SETUP.md
git commit -m "ci: validate wine diary drafts"
```

---

### Task 9: Deployment and private end-to-end acceptance checkpoint

**Files:**
- Modify only if verification finds an error: `docs/WINE_DIARY_CAPTURE_SETUP.md`
- Do not commit: live `.env` files, API keys, GitHub tokens, exported GPT secrets, or downloaded user photos.

**Interfaces:**
- Consumes: the deployable Vercel service, Action schema, GPT instructions, and GitHub token permissions.
- Produces: a live private GPT that creates a draft pull request from desktop and mobile.

- [ ] **Step 1: Create the Vercel project and configure secrets through the provider UI or authenticated CLI**

Set the project root to `services/wine-diary-api`, select Node.js 24, and add the five required production/preview environment variables. Never paste either secret into chat or a tracked command file.

- [ ] **Step 2: Deploy and run unauthenticated/authenticated smoke checks**

Verify a request without Authorization returns `401` and an authenticated invalid body returns `400` without revealing environment data. Use a local shell environment variable for the API key so it is not written to history or the repository.

- [ ] **Step 3: Configure the private GPT**

Paste `instructions.md`, import the deployed `action.openapi.yaml`, configure Bearer API-key authentication, keep the GPT private, and verify the builder recognizes `createWineDraft` as consequential.

- [ ] **Step 4: Perform desktop acceptance**

Use a non-sensitive bottle photo and brain-dump, correct one inferred field, confirm the preview, and verify the returned URL is a draft pull request containing one Markdown file and one normalized WebP file. Verify the PR validation workflow passes.

- [ ] **Step 5: Perform mobile acceptance**

Open the same private GPT in the ChatGPT mobile app, attach a bottle photo, use voice dictation, confirm the proposed verdict/score, and verify a second draft pull request is created without any desktop host online.

- [ ] **Step 6: Verify privacy, idempotency, and publication boundary**

Confirm the WebP has no GPS/EXIF metadata, retry the same capture and confirm no duplicate PR appears, verify neither PR changed `main`, then close the test PRs without merging unless their content is intended for the public diary.

- [ ] **Step 7: Record the operational handoff**

Confirm Bart knows how to rotate both credentials, redeploy the API, update the GPT Action server URL, retry an expired photo, review a draft, mark it ready, merge it, and verify GitHub Pages deployment.

---

## Final completion gate

The feature is complete only when Tasks 1–8 pass locally and in GitHub Actions, and Task 9 succeeds on both desktop and mobile. If deployment credentials or ChatGPT Builder access are unavailable, report the exact remaining Task 9 steps and treat the code as deployable but not yet operational.
