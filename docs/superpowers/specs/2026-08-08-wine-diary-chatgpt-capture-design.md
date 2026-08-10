# ChatGPT Wine Diary Capture Design

**Date:** 2026-08-08

**Status:** Approved design

**Site:** `https://bartwagener.com/wine/`

**Repository:** `bwag84/bwag84`

## Summary

Create a dedicated Wine Diary GPT that Bart can use from ChatGPT on desktop or mobile. Bart attaches a bottle photo and speaks or types natural tasting notes. The GPT turns that brain-dump into a consistent wine review, asks Bart to confirm its proposed verdict and score, then calls a secure serverless endpoint. The endpoint normalizes the image, creates the Hugo entry on a new Git branch, and opens a draft pull request for review.

No capture writes directly to `main`. Publishing remains the deliberate act of reviewing and merging the pull request.

## Goals

- Capture a tasting quickly enough to use at a restaurant, another person's home, or while travelling.
- Use the same dedicated GPT from ChatGPT desktop and mobile.
- Accept a bottle photo and use it both for label recognition and as the published featured image.
- Allow free-form spoken or typed notes instead of forcing a questionnaire.
- Produce a consistent review with required metadata, a categorical verdict, and a score.
- Preserve personal context that falls outside the tasting template.
- Save every confirmed capture as a reviewable GitHub draft pull request.
- Prevent accidental publication, duplicate captures, metadata leakage, and malformed Hugo content.

## Non-goals for the first version

- Directly publishing or merging from ChatGPT.
- Editing or deleting existing wine entries from ChatGPT.
- Retrospectively assigning verdicts or photos to existing entries.
- Supporting galleries or more than one featured bottle photo per capture.
- Building a general-purpose CMS or a public multi-user service.
- Requiring Bart's laptop or Codex Remote host to remain online.

## Current site contract

Wine entries live at `content/wine/YYYY-MM-DD-slug.md`. Featured images live under `static/images/`, and Hugo references them with a path beginning at `/images/`. The site deploys from `main` through the existing GitHub Pages workflow.

The capture workflow must preserve the current wine fields and add one new required field, `verdict`.

## User experience

### Starting a capture

Bart opens the dedicated Wine Diary GPT and provides:

- A bottle photo, when available.
- A natural brain-dump about the tasting.

The photo is recommended, not mandatory. A tasting without a usable photo must still be capturable.

On mobile, the dependable spoken path is voice dictation in the message composer, which turns Bart's speech into the prompt sent to the GPT. The first version does not depend on live Voice mode being able to execute a custom action.

Example inputs include:

- "Wine diary entry. This smells like cassis and vanilla, very soft, 88-ish, definitely one I would buy again. We drank it with lamb at Mark's house."
- "Add this bottle. Pretty label, but the wine tastes medicinal on its own. It worked surprisingly well with the white fish."
- A bottle photo followed by voice dictation with impressions in any order.

### Extraction and follow-up

The GPT extracts factual label details and subjective observations from the photo and brain-dump. It may research missing factual metadata such as region or grape composition when the product can be identified confidently.

It asks one concise follow-up containing only information that remains necessary. It must not turn the interaction into a fixed questionnaire.

The GPT must not invent sensory notes, context, grape varieties, origin details, or certainty. If a factual field cannot be established, it asks Bart or marks the field as unknown in the preview. A confirmed unknown value is represented as an empty value or empty list in front matter rather than fabricated content.

### Preview and confirmation

Before calling the publishing endpoint, the GPT shows a human-readable preview containing:

- Identified wine and vintage.
- Region and grapes.
- Draft review text.
- Proposed `Class`, `Pass`, or `Arse` verdict.
- Proposed whole-number score out of 100.
- Buy-again choice.
- Whether the attached photo will be included.

The final preview must end with an explicit confirmation prompt, for example:

> Proposed verdict: Pass — 84/100
>
> Buy again: Yes
>
> Create the draft pull request?

The GPT must not call the endpoint until Bart explicitly confirms or corrects the preview.

### Completion

After a successful call, the GPT returns:

- The draft pull-request URL.
- The generated entry path.
- A short statement that the entry is not live until the pull request is merged.

## Content contract

### Front matter

Every new entry uses YAML front matter with the following fields:

| Field | Requirement | Rule |
|---|---|---|
| `title` | Required | Human-readable wine title, normally including vintage. |
| `date` | Required | Tasting date in `YYYY-MM-DD`, using `Europe/Amsterdam` when "today" is implied. |
| `slug` | Required | Deterministically generated ASCII kebab-case slug. After idempotency is checked, append `-2`, `-3`, and so on when a different capture already occupies the same dated content path. |
| `producer` | Required | Producer shown on the label or confirmed through research. May be empty only after confirmation. |
| `vintage` | Required | Quoted string to preserve non-numeric vintages. May be empty for non-vintage wine. |
| `country` | Required | Country of origin. May be empty only after confirmation. |
| `region` | Required | Wine region. May be empty only after confirmation. |
| `grapes` | Required | YAML list. May be an empty list only after confirmation. |
| `rating` | Required | Quoted whole number from `0` through `100`. Contextual caveats belong in the body, not in this value. |
| `verdict` | Required | Exactly `Class`, `Pass`, or `Arse`. |
| `would_buy_again` | Required | Exactly `Yes` or `No`. |
| `buy_again` | Required | Boolean equivalent of `would_buy_again`. |
| `status` | Required | Defaults to `drunk`; use `benchmark` only when Bart identifies the wine as a benchmark. |
| `featured_image` | Conditional | `/images/wine/YYYY-MM-DD-slug.webp` when a photo is supplied; omit when there is no photo. |
| `tags` | Required | YAML list derived from wine type, grape, region, context, and verdict where useful. |

`verdict` and `buy_again` are independent judgments. In particular, a `Pass` may be either a buy-again Yes or No. No automatic score ranges map to verdicts. The GPT proposes both from Bart's language, and Bart's confirmation is authoritative.

### Review body

The generated Markdown body uses these headings and this order:

1. `## First impression`
2. `## What I noticed`
3. `## Verdict`
4. `## Context` when meaningful contextual material exists

The first three sections are required. `Context` is optional and deliberately free-form. It may include:

- Food pairing and how food changed the wine.
- Restaurant, home, holiday, or other setting.
- Who shared the wine or the occasion.
- Bottle or label design.
- Price, serving temperature, glassware, or service.
- A personal story or any unusual detail connected to the bottle.

The GPT actively preserves context mentioned by Bart but does not infer private location or companion information. It omits the section when there is nothing meaningful to add.

The prose may be lightly edited for clarity and organization but must preserve Bart's opinion, specificity, and characteristic wording. It must not become winery marketing copy.

### Site display

New wine cards and single-entry pages display the verdict as a badge. The display logic is conditional so existing entries without `verdict` continue to render normally. The first version does not backfill old content.

## Architecture

### Components

1. **Dedicated Wine Diary GPT**
   - Contains the conversational workflow and content rules.
   - Uses vision and, when available, web research to identify factual metadata.
   - Exposes one write action for creating a confirmed draft.

2. **GPT Action definition**
   - OpenAPI document describing one authenticated `POST` operation.
   - Sends the structured review and at most one conversation file through `openaiFileIdRefs`.
   - Uses API-key authentication configured in the GPT editor.

3. **Wine Diary API**
   - Small Node.js serverless service, initially deployed to Vercel.
   - Validates and sanitizes the request.
   - Immediately downloads OpenAI's short-lived image URL.
   - Converts the image to WebP and removes metadata.
   - Uses GitHub's APIs to create a branch, commit files, and open a draft pull request.

4. **GitHub validation workflow**
   - Runs for wine-diary pull requests.
   - Builds the Hugo site using the repository's pinned toolchain.
   - Blocks merge readiness when generated content is invalid.

5. **Hugo verdict display**
   - Adds a verdict badge to the existing wine list and single-entry overrides.
   - Preserves rendering for historical entries without the new field.

### Data flow

1. Bart uploads a photo and gives free-form notes.
2. The GPT extracts and drafts the structured entry.
3. Bart confirms the preview.
4. The GPT calls `POST /v1/captures` with a unique `capture_id` and optional `openaiFileIdRefs`.
5. The API authenticates, validates, and normalizes all inputs before changing GitHub.
6. When present, the API downloads and processes the photo while its temporary URL remains valid.
7. The API reads the current `main` branch head.
8. It creates `wine-diary/YYYY-MM-DD-slug-SHORT_ID` from that head.
9. It creates the Markdown entry and optional WebP photo on the new branch.
10. It opens a draft pull request targeting `main`.
11. It returns the pull-request URL and generated paths to ChatGPT.
12. Bart reviews and merges the pull request; the existing Pages deployment publishes the entry.

## API contract

### Request

`POST /v1/captures`

Authentication:

```http
Authorization: Bearer <capture-api-key>
Content-Type: application/json
```

Conceptual request body:

```json
{
  "capture_id": "stable-unique-id",
  "wine": {
    "title": "Example Wine 2024",
    "date": "2026-08-08",
    "producer": "Example Producer",
    "vintage": "2024",
    "country": "France",
    "region": "Alsace",
    "grapes": ["Gewürztraminer"],
    "rating": 84,
    "verdict": "Pass",
    "would_buy_again": "No",
    "status": "drunk",
    "tags": ["white", "Gewürztraminer", "Alsace"]
  },
  "review": {
    "first_impression": "Aromatic and generous, but much better with food than on its own.",
    "what_i_noticed": "Rose, lychee and spice, with a medicinal edge when tasted without food.",
    "verdict": "84/100. A Pass: distinctive and enjoyable in the right setting, but too perfumed for casual drinking.",
    "context": "It was excellent with white fish but medicinal on its own."
  },
  "openaiFileIdRefs": []
}
```

The endpoint derives `slug`, `buy_again`, `featured_image`, branch name, file paths, and Markdown serialization. The model must not control repository paths.

### Success response

```json
{
  "status": "created",
  "capture_id": "stable-unique-id",
  "pull_request_url": "https://github.com/bwag84/bwag84/pull/123",
  "content_path": "content/wine/2026-08-08-example-wine.md",
  "image_path": "static/images/wine/2026-08-08-example-wine.webp"
}
```

An idempotent replay returns the same data with `status` set to `already_exists`.

## Photo handling

- Accept zero or one uploaded conversation file.
- Accept common still-image formats supported by the image decoder, including JPEG, PNG, WebP, and HEIC when the deployed runtime supports it.
- Reject non-image files, animated images, malformed images, and oversized inputs.
- Download the image before the OpenAI link expires.
- Correct orientation, resize to the configured maximum dimensions, and encode as WebP.
- Strip EXIF, GPS, camera serial numbers, thumbnails, and other source metadata.
- Store only the normalized WebP image in the repository.
- Use a deterministic destination path derived by the server.
- If no image is provided, omit `featured_image` and continue normally.

## GitHub behavior

- Read the current SHA of `main` at capture time.
- Create one uniquely named branch per capture.
- Create one atomic commit containing the entry and optional photo, using GitHub's Git database APIs rather than separate per-file commits.
- Create a draft pull request with a concise title such as `Add wine note: Example Wine 2024`.
- Include a pull-request summary table with verdict, score, region, grapes, and buy-again choice.
- Do not automatically merge, close, or publish the pull request.
- Do not modify existing wine entries.
- Treat an existing `capture_id`, branch, or open pull request as an idempotency case. When a different capture has the same dated slug, select the next available numeric slug suffix and never overwrite the existing entry.

## Authentication and secrets

- Configure a random high-entropy API key in the GPT Action and the serverless environment.
- Compare the presented credential without logging it.
- Store the GitHub credential only in the serverless provider's secret store.
- Use a fine-grained GitHub token restricted to `bwag84/bwag84`, with repository Contents and Pull Requests permissions only as required.
- Never expose GitHub credentials, OpenAI file URLs, authorization headers, or environment values in responses, logs, commits, or pull requests.
- Provide token rotation instructions as part of setup.

## Validation and safety

The API validates the complete request before changing GitHub:

- Reject unknown top-level properties where practical.
- Enforce length limits on all strings and arrays.
- Enforce the verdict enum and integer score range.
- Enforce `Yes` or `No` and derive the boolean server-side.
- Validate the date and prevent future dates unless explicitly allowed later.
- Generate and validate the slug server-side.
- Escape YAML scalars and serialize with a YAML library rather than string concatenation.
- Reject path separators, control characters, and traversal sequences from derived identifiers.
- Sanitize Markdown without stripping Bart's normal prose.
- Allow ordinary links in review prose but never use user-supplied paths or URLs as write destinations.
- Limit the endpoint to the configured repository owner, repository name, base branch, and content directories.

## Idempotency and failure handling

`capture_id` is required and stable across retries of the same confirmed capture. The API records it in a machine-readable pull-request marker and uses it when detecting retries.

Processing order is transactional where possible:

1. Authenticate and validate.
2. Download and fully process the optional image in memory or temporary storage.
3. Render and validate Markdown.
4. Create the branch and files.
5. Create the draft pull request.

Failures before GitHub mutation leave no branch or files. If a failure occurs after branch creation, the API returns a precise recoverable error and reuses the same branch on retry without overwriting unrelated content.

The GPT keeps the confirmed preview visible in the conversation. It reports errors plainly and does not claim that a draft exists unless the API returns a pull-request URL. An expired image link requires Bart to reattach the photo; the written tasting remains available in the conversation.

## Verification strategy

### Unit tests

- Schema validation and rejection cases.
- Verdict, score, date, and buy-again normalization.
- Slug generation, Unicode handling, and collision behavior.
- YAML serialization and hostile-string cases.
- Markdown rendering with and without `Context`.
- Idempotency decisions.
- Image type, orientation, resizing, conversion, and metadata stripping.

### Integration tests

- GPT Action request shape, including `openaiFileIdRefs`.
- Temporary file download success, expiry, and invalid MIME behavior.
- Mocked GitHub branch, contents, and pull-request API interactions.
- Retry after each possible partial GitHub failure.
- Verification that no secret or temporary file URL appears in logs or pull-request content.

### Repository validation

- Generate representative Class, Pass, and Arse fixtures.
- Generate entries with and without `Context` and with and without a photo.
- Run `hugo --gc --minify` against each generated fixture.
- Verify verdict badge rendering on list and single pages.
- Verify historical entries without `verdict` still render.
- Add pull-request validation that uses Hugo 0.128.0, matching production.

### Manual end-to-end acceptance

From both desktop and mobile ChatGPT:

1. Attach a bottle photo.
2. Dictate an unstructured tasting with contextual details.
3. Correct one inferred field in the preview.
4. Confirm the draft.
5. Verify that ChatGPT returns a draft pull-request link.
6. Verify the Markdown, image, verdict badge, and Hugo build in the pull request.
7. Merge the pull request and verify the public wine page after Pages deployment.

## Implementation deliverables

- Preflight verification that Bart's ChatGPT account can create or use the private GPT on desktop and in the mobile app.
- Dedicated GPT instruction text.
- GPT Action OpenAPI schema.
- Serverless Node.js Wine Diary API with tests.
- Environment and secret configuration example without live credentials.
- Vercel deployment configuration.
- GitHub pull-request validation workflow.
- Hugo verdict badge updates in layout overrides.
- Updated wine archetype containing the new contract.
- Setup checklist for configuring the private GPT, API key, GitHub token, and Vercel environment.

## Acceptance criteria

- Bart can complete a photo-backed capture through natural language on desktop and mobile.
- The GPT asks only for missing information and always requires final confirmation.
- Every generated review contains the three required sections and includes `Context` when supplied.
- Every entry has a confirmed Class/Pass/Arse verdict, integer score, buy-again choice, and current wine metadata fields.
- The normalized bottle photo appears on the wine card and entry without retained EXIF/GPS metadata.
- A successful capture creates exactly one draft pull request and never writes to `main`.
- Retrying the same capture does not create duplicate content or pull requests.
- Generated content builds successfully with Hugo 0.128.0.
- Existing wine entries continue to render unchanged.
- No laptop or local Codex session is required after deployment.

## Reference constraints

- OpenAI GPT Actions can send up to ten conversation files to a POST action through the specially named `openaiFileIdRefs` field. The action receives temporary download links, so the API must copy the selected bottle photo immediately: <https://platform.openai.com/docs/actions/sending-files>.
- GPT Action API-key secrets are encrypted when stored in the GPT editor: <https://platform.openai.com/docs/actions/authentication>.
- GitHub exposes Git database and pull-request APIs for creating an atomic commit and opening a draft pull request: <https://docs.github.com/en/rest/git/commits#create-a-commit> and <https://docs.github.com/en/rest/pulls/pulls#create-a-pull-request>.
