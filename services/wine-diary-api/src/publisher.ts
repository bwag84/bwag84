import { renderWineMarkdown } from "./markdown.js";
import {
  captureIdSuffix,
  contentPath,
  imagePath,
  slugifyWineTitle,
  withNumericSuffix,
} from "./slug.js";
import {
  AppError,
  type DraftPullRequestInput,
  type PublishInput,
  type PublishResult,
  type RepositoryFile,
  type RepositoryGateway,
  type ValidatedCapture,
} from "./types.js";

function firstAvailableSlug(
  baseSlug: string,
  date: string,
  reservedPaths: ReadonlySet<string>,
): string {
  for (let ordinal = 1; ordinal <= 10_000; ordinal += 1) {
    const candidate = withNumericSuffix(baseSlug, ordinal);
    if (!reservedPaths.has(contentPath(date, candidate))) return candidate;
  }
  throw new AppError("SLUG_EXHAUSTED", 409, "No available content path could be found.");
}

function publicImagePath(repositoryImagePath: string): string {
  return `/${repositoryImagePath.replace(/^static\//, "")}`;
}

function repositoryFiles(
  capture: ValidatedCapture,
  slug: string,
  photo: Buffer | null,
): RepositoryFile[] {
  const repositoryImagePath = photo ? imagePath(capture.wine.date, slug) : null;
  const markdown = renderWineMarkdown(
    capture,
    slug,
    repositoryImagePath ? publicImagePath(repositoryImagePath) : null,
  );
  const files: RepositoryFile[] = [
    {
      path: contentPath(capture.wine.date, slug),
      content: Buffer.from(markdown, "utf8"),
    },
  ];
  if (photo && repositoryImagePath) {
    files.push({ path: repositoryImagePath, content: photo });
  }
  return files;
}

function tableCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function pullRequestInput(
  capture: ValidatedCapture,
  branch: string,
  files: RepositoryFile[],
): DraftPullRequestInput {
  const contentFile = files[0];
  if (!contentFile) throw new AppError("EMPTY_COMMIT", 500, "No wine entry was generated.");
  const imageFile = files[1] ?? null;
  const body = [
    `<!-- wine-capture-id: ${capture.captureId} -->`,
    `<!-- wine-content-path: ${contentFile.path} -->`,
    `<!-- wine-image-path: ${imageFile?.path ?? "none"} -->`,
    "",
    "## Wine diary draft",
    "",
    "| Field | Value |",
    "|---|---|",
    `| Verdict | ${tableCell(capture.wine.verdict)} |`,
    `| Score | ${capture.wine.rating}/100 |`,
    `| Region | ${tableCell(capture.wine.region || "Unknown")} |`,
    `| Grapes | ${tableCell(capture.wine.grapes.join(", ") || "Unknown")} |`,
    `| Buy again | ${capture.wine.wouldBuyAgain} |`,
    "",
    `Content: \`${contentFile.path}\``,
    imageFile ? `Photo: \`${imageFile.path}\`` : "Photo: not supplied",
    "",
    "This is a draft pull request. The wine entry is not live until this pull request is reviewed, marked ready, and merged.",
  ].join("\n");

  return {
    branch,
    title: `Add wine note: ${capture.wine.title}`,
    body,
    draft: true,
  };
}

export async function publishCapture(
  input: PublishInput,
  gateway: RepositoryGateway,
): Promise<PublishResult> {
  const existing = await gateway.findDraftByCaptureId(input.capture.captureId);
  if (existing) return existing;

  const reserved = await gateway.listReservedContentPaths();
  const baseSlug = slugifyWineTitle(input.capture.wine.title);
  const slug = firstAvailableSlug(baseSlug, input.capture.wine.date, reserved);
  const branch = [
    "wine-diary",
    `${input.capture.wine.date}-${slug}-${captureIdSuffix(input.capture.captureId)}`,
  ].join("/");
  const files = repositoryFiles(input.capture, slug, input.photo);

  const branchCaptureId = await gateway.getBranchCaptureId(branch);
  if (branchCaptureId === null) {
    await gateway.createAtomicCommitBranch(
      branch,
      files,
      `Add wine note: ${input.capture.wine.title}\n\nWine-Capture-ID: ${input.capture.captureId}`,
    );
  } else if (branchCaptureId !== input.capture.captureId) {
    throw new AppError(
      "BRANCH_COLLISION",
      409,
      "The generated draft branch is already in use.",
    );
  }

  const pullRequest = await gateway.createDraftPullRequest(
    pullRequestInput(input.capture, branch, files),
  );
  return {
    status: "created",
    captureId: input.capture.captureId,
    pullRequestUrl: pullRequest.url,
    contentPath: files[0]?.path ?? contentPath(input.capture.wine.date, slug),
    imagePath: files[1]?.path ?? null,
  };
}
