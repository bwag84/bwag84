# Wine Diary GPT Setup

This checklist connects the private Wine Diary GPT to the serverless capture and personal taste API backed by `bwag84/bwag84`. It contains no live credentials.

## 1. Preflight

- Confirm the ChatGPT account can create a private GPT on desktop.
- Confirm the same private GPT appears in the ChatGPT mobile app.
- Keep the GPT private (`Only me`). This integration can write to the blog repository.
- Use voice dictation in the mobile message composer for spoken notes. The workflow does not depend on live Voice mode invoking Actions.

## 2. Create the GitHub credential

Create a fine-grained personal access token in GitHub:

- Resource owner: `bwag84`.
- Repository access: only `bwag84/bwag84`.
- Repository permissions:
  - Contents: Read and write.
  - Pull requests: Read and write.
  - Metadata: Read-only, added automatically by GitHub.
- Choose a practical expiry date and record a reminder to rotate it.

Do not put the token in this repository, a ChatGPT message, the GPT instructions, or the Action schema.

## 3. Generate the private Action credential

Generate a high-entropy value locally:

```bash
openssl rand -base64 48
```

Store it in a password manager until both Vercel and the GPT Action are configured. Do not save it in a tracked file or paste it into chat.

## 4. Deploy the API to Vercel

Create a Vercel project whose Root Directory is:

```text
services/wine-diary-api
```

Use Node.js 24. Configure these environment variables for Production and Preview:

```text
CAPTURE_API_KEY
GITHUB_TOKEN
GITHUB_OWNER=bwag84
GITHUB_REPO=bwag84
GITHUB_BASE_BRANCH=main
```

Enter secrets through the Vercel dashboard or interactive CLI prompts. Do not place them directly in a shell command that will be saved to history.

The API receives photo references as short JSON URLs, not the photo bytes in the incoming request. Vercel's 4.5 MB request-body limit therefore does not prevent normal phone photos from reaching the API. The API downloads at most one photo and independently enforces a 20 MiB source-image limit.

After deployment, verify the public origin uses HTTPS and that all private routes respond with `401` when called without a credential:

```bash
curl -sS -i https://wine-diary-api.vercel.app/v1/captures
curl -sS -i https://wine-diary-api.vercel.app/v1/taste-profile
curl -sS -i -X POST \
  -H 'Content-Type: application/json' \
  -d '{"grapes":["Cabernet Sauvignon"]}' \
  https://wine-diary-api.vercel.app/v1/taste-context
```

Each response should contain HTTP status `401` and error code `UNAUTHORIZED`. That proves the route is live without exposing private diary access.

For an authenticated read-only smoke test, enter the existing Action key silently into a temporary shell variable. The cursor does not move while the key is being entered; paste it once and press Enter:

```bash
printf 'Paste CAPTURE_API_KEY and press Enter: '
IFS= read -rs CAPTURE_API_KEY
printf '\n'

curl -sS \
  -H "Authorization: Bearer $CAPTURE_API_KEY" \
  https://wine-diary-api.vercel.app/v1/taste-profile

curl -sS -X POST \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CAPTURE_API_KEY" \
  -d '{"grapes":["Cabernet Sauvignon"],"limit":3}' \
  https://wine-diary-api.vercel.app/v1/taste-context

unset CAPTURE_API_KEY
```

Do not paste the key into chat, a tracked file, or directly into a command that shell history will retain.

## 5. Add the Action schema

Import `integrations/chatgpt-wine-diary/action.openapi.yaml` in the GPT Builder. It already points to the production origin `https://wine-diary-api.vercel.app`. Keep all three paths unchanged: `/v1/captures`, `/v1/taste-profile`, and `/v1/taste-context`.

## 6. Create the private GPT

In the GPT Builder:

1. Create a GPT named `Bart's Wine Diary`.
2. Paste `integrations/chatgpt-wine-diary/instructions.md` into Instructions.
3. Enable image understanding and web search if those capabilities are available.
4. Add an Action and import the updated OpenAPI schema.
5. Choose API key authentication.
6. Choose Bearer authorization.
7. Enter the `CAPTURE_API_KEY` value generated in step 3.
8. Confirm that `createWineDraft` is consequential and that `getTasteProfile` and `getTasteContext` are non-consequential read actions.
9. Save the GPT as `Only me`.

OpenAI stores GPT Action API-key secrets encrypted. The GitHub token remains only in Vercel and is never sent to ChatGPT.

## 7. Desktop acceptance test

Use a non-sensitive bottle photo and a clearly marked test tasting:

1. Attach the photo.
2. Give an unstructured tasting note with a food or location detail.
3. Verify the GPT asks only for missing information.
4. Correct one inferred value.
5. Verify the revised preview has `First impression`, `What I noticed`, `Verdict`, and `Context`.
6. Confirm the proposed Class/Pass/Arse verdict, integer score, and buy-again choice.
7. Approve creation of the draft.
8. Open the returned GitHub URL.
9. Verify the pull request is a draft containing one Markdown file and one WebP photo.
10. Verify the validation workflow passes.

Close the test pull request without merging unless it is intended for the public diary.

## 8. Mobile acceptance test

With the desktop host offline:

1. Open the same private GPT in the ChatGPT mobile app.
2. Attach a new bottle photo.
3. Use voice dictation in the message composer for the tasting.
4. Confirm the preview.
5. Verify a second draft pull request is created.
6. Retry the same confirmed capture and verify the existing pull request is returned instead of creating a duplicate.

## 9. Personal taste retrieval acceptance test

After at least one wine entry is merged to `main`, ask the private GPT:

1. `What red-wine characteristics do I repeatedly enjoy?`
2. `Which wines in my diary are closest to Cabernet Sauvignon?`
3. `What have I disliked, and is each point a repeated pattern or only one bottle?`
4. `Compare this southern French red with my previous ratings.`

Verify that the GPT names supporting diary wines, distinguishes repeated evidence from one example, and never turns a missing historical field into a negative preference. Retrieval should not request confirmation because both history operations are read-only.

## 10. Review and publish

The Action never publishes directly:

1. Open the returned draft pull request.
2. Review the Markdown, photo, metadata, and verdict badge preview.
3. Wait for validation checks to pass.
4. Mark the pull request ready for review.
5. Merge it into `main`.
6. Verify the existing GitHub Pages workflow completes.
7. Check the public wine diary entry.

## 11. Rotation and recovery

If the Action returns `UNAUTHORIZED`, replace `CAPTURE_API_KEY` in both Vercel and the GPT Action, then redeploy. Never ask for or provide the key in a ChatGPT conversation.

If GitHub authorization fails, create a replacement fine-grained token with the same repository restriction and permissions, update `GITHUB_TOKEN` in Vercel, redeploy, and revoke the old token.

If a secret is exposed anywhere, rotate it immediately. Git history cleanup is not a substitute for revocation.

If a photo link expires, reattach only the photo in the same conversation. The GPT must keep the confirmed tasting and reuse its original `capture_id`.

## 12. Personal taste memory architecture

The memory is deliberately simple and reviewable:

- Merged Markdown files under `content/wine/` are the only durable source of truth.
- `GET /v1/taste-profile` calculates totals, averages, favorites, dislikes, benchmarks, and repeated evidence.
- `POST /v1/taste-context` deterministically ranks the most relevant previous wines from name, producer, grapes, country, region, tags, and Bart's own prose.
- The service checks the configured GitHub base-branch commit SHA on every read. A warm Vercel function reuses its parsed catalogue while that SHA is unchanged and reloads automatically after a merge.
- Draft pull requests are not memory yet. They become retrievable after review and merge to `main`.
- There is no separate database, embedding store, generated preference file, or server-side LLM call in this phase.
- Older posts remain useful even when score, verdict, vintage, grapes, or other fields are missing. Unknown values stay unknown.

History informs a comparison but never overrides Bart's current judgment. If GitHub retrieval is temporarily unavailable, the GPT continues capturing the current tasting without personal-history context.

## 13. Local verification and operating limits

Use Node.js 24, which matches the pull-request workflow. From the repository root, run:

```bash
cd services/wine-diary-api
npm ci
npm test
npm run typecheck

cd ../..
npm ci
bash tests/hugo-wine-verdict.sh
npm run build
```

The API package intentionally has no generic `build` script. Vercel treats that name as a static-site build and expects a public output directory; this project consists only of functions under `api/`. `npm run typecheck` is its compile-time verification step. TypeScript is pinned to the latest compatible 6.x release because Vercel's Node function builder currently loads the JavaScript compiler API that TypeScript 7 no longer exposes in the same package.

The GitHub workflow additionally pins Hugo Extended 0.128.0, matching the existing deployment workflow. Local Hugo versions can be newer, but the pull-request check is the release gate.

Operational boundaries:

- One capture accepts exactly one attached bottle photo, up to 20 MiB before normalization.
- ChatGPT's temporary photo URL can expire; reattach the photo without changing the confirmed `capture_id`.
- Live Voice mode is not required. On mobile, use voice dictation in the normal message composer.
- The GPT must show the complete structured preview and receive explicit approval before calling the Action.
- The API can create or recover a draft pull request only. Publishing still requires a human merge to `main`.
- Repeating the same confirmed capture returns its existing draft pull request instead of creating a duplicate.
- Personal taste operations return only merged wine entries from the configured base branch.
- The first read after a new merge reloads the catalogue; later reads at the same commit reuse the warm cache.

## References

- OpenAI file transfer for GPT Actions: <https://platform.openai.com/docs/actions/sending-files>
- OpenAI GPT Action authentication: <https://platform.openai.com/docs/actions/authentication>
- GitHub fine-grained personal access tokens: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>
- Vercel Node.js versions: <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>
- Vercel function limits: <https://vercel.com/docs/functions/limitations>
