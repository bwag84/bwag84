# Wine Diary Capture Setup

This checklist connects the private Wine Diary GPT to the serverless capture API and `bwag84/bwag84`. It contains no live credentials.

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

After deployment, verify the public origin uses HTTPS and that this URL responds with `401` when called without a credential:

```text
https://wine-diary-api.vercel.app/v1/captures
```

## 5. Add the Action schema

Import `integrations/chatgpt-wine-diary/action.openapi.yaml` in the GPT Builder. It already points to the production origin `https://wine-diary-api.vercel.app`. Do not change the `/v1/captures` path.

## 6. Create the private GPT

In the GPT Builder:

1. Create a GPT named `Bart's Wine Diary`.
2. Paste `integrations/chatgpt-wine-diary/instructions.md` into Instructions.
3. Enable image understanding and web search if those capabilities are available.
4. Add an Action and import the updated OpenAPI schema.
5. Choose API key authentication.
6. Choose Bearer authorization.
7. Enter the `CAPTURE_API_KEY` value generated in step 3.
8. Confirm that `createWineDraft` is shown as a consequential action.
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

## 9. Review and publish

The Action never publishes directly:

1. Open the returned draft pull request.
2. Review the Markdown, photo, metadata, and verdict badge preview.
3. Wait for validation checks to pass.
4. Mark the pull request ready for review.
5. Merge it into `main`.
6. Verify the existing GitHub Pages workflow completes.
7. Check the public wine diary entry.

## 10. Rotation and recovery

If the Action returns `UNAUTHORIZED`, replace `CAPTURE_API_KEY` in both Vercel and the GPT Action, then redeploy. Never ask for or provide the key in a ChatGPT conversation.

If GitHub authorization fails, create a replacement fine-grained token with the same repository restriction and permissions, update `GITHUB_TOKEN` in Vercel, redeploy, and revoke the old token.

If a secret is exposed anywhere, rotate it immediately. Git history cleanup is not a substitute for revocation.

If a photo link expires, reattach only the photo in the same conversation. The GPT must keep the confirmed tasting and reuse its original `capture_id`.

## 11. Local verification and operating limits

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

## References

- OpenAI file transfer for GPT Actions: <https://platform.openai.com/docs/actions/sending-files>
- OpenAI GPT Action authentication: <https://platform.openai.com/docs/actions/authentication>
- GitHub fine-grained personal access tokens: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens>
- Vercel Node.js versions: <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>
- Vercel function limits: <https://vercel.com/docs/functions/limitations>
