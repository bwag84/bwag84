import { describe, expect, it } from "vitest";

import { publishCapture } from "../src/publisher.js";
import type {
  DraftPullRequestInput,
  PublishResult,
  RepositoryFile,
  RepositoryGateway,
  ValidatedCapture,
} from "../src/types.js";

const capture: ValidatedCapture = {
  captureId: "capture-20260808-abc123",
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
    wouldBuyAgain: "No",
    buyAgain: false,
    status: "drunk",
    tags: ["white", "Alsace"],
  },
  review: {
    firstImpression: "Aromatic and generous.",
    whatINoticed: "Rose, lychee and spice.",
    verdict: "84/100. A Pass in the right setting.",
    context: "Excellent with white fish but medicinal on its own.",
  },
  file: null,
};

class FakeGateway implements RepositoryGateway {
  public existing: PublishResult | null = null;
  public reserved = new Set<string>();
  public branchCaptureId: string | null = null;
  public committedBranch: string | null = null;
  public committedFiles: RepositoryFile[] = [];
  public commitMessage = "";
  public pullRequestInput: DraftPullRequestInput | null = null;

  public async findDraftByCaptureId(): Promise<PublishResult | null> {
    return this.existing;
  }

  public async listReservedContentPaths(): Promise<Set<string>> {
    return this.reserved;
  }

  public async getBranchCaptureId(): Promise<string | null> {
    return this.branchCaptureId;
  }

  public async createAtomicCommitBranch(
    branch: string,
    files: RepositoryFile[],
    message: string,
  ): Promise<void> {
    this.committedBranch = branch;
    this.committedFiles = files;
    this.commitMessage = message;
  }

  public async createDraftPullRequest(input: DraftPullRequestInput): Promise<{ url: string }> {
    this.pullRequestInput = input;
    return { url: "https://github.com/bwag84/bwag84/pull/123" };
  }
}

describe("publishCapture", () => {
  it("creates one controlled Markdown file and draft pull request", async () => {
    const gateway = new FakeGateway();

    const result = await publishCapture({ capture, photo: null }, gateway);

    expect(result).toEqual({
      status: "created",
      captureId: capture.captureId,
      pullRequestUrl: "https://github.com/bwag84/bwag84/pull/123",
      contentPath: "content/wine/2026-08-08-example-gewurztraminer-2024.md",
      imagePath: null,
    });
    expect(gateway.committedBranch).toMatch(
      /^wine-diary\/2026-08-08-example-gewurztraminer-2024-[a-f0-9]{12}$/,
    );
    expect(gateway.committedFiles.map((file) => file.path)).toEqual([
      "content/wine/2026-08-08-example-gewurztraminer-2024.md",
    ]);
    expect(gateway.commitMessage).toContain(`Wine-Capture-ID: ${capture.captureId}`);
    expect(gateway.pullRequestInput?.draft).toBe(true);
    expect(gateway.pullRequestInput?.body).toContain(
      `<!-- wine-capture-id: ${capture.captureId} -->`,
    );
  });

  it("commits the normalized photo beside the Markdown", async () => {
    const gateway = new FakeGateway();
    const photo = Buffer.from("normalized-webp");

    const result = await publishCapture({ capture, photo }, gateway);

    expect(result.imagePath).toBe(
      "static/images/wine/2026-08-08-example-gewurztraminer-2024.webp",
    );
    expect(gateway.committedFiles).toHaveLength(2);
    expect(gateway.committedFiles[1]).toMatchObject({
      path: "static/images/wine/2026-08-08-example-gewurztraminer-2024.webp",
    });
    expect(gateway.committedFiles[1]?.content).toEqual(photo);
  });

  it("returns an existing draft without querying paths or mutating GitHub", async () => {
    const gateway = new FakeGateway();
    gateway.existing = {
      status: "already_exists",
      captureId: capture.captureId,
      pullRequestUrl: "https://github.com/bwag84/bwag84/pull/99",
      contentPath: "content/wine/2026-08-08-example-gewurztraminer-2024.md",
      imagePath: null,
    };

    const result = await publishCapture({ capture, photo: null }, gateway);

    expect(result).toBe(gateway.existing);
    expect(gateway.committedBranch).toBeNull();
    expect(gateway.pullRequestInput).toBeNull();
  });

  it("chooses the next numeric slug when a path is reserved", async () => {
    const gateway = new FakeGateway();
    gateway.reserved.add("content/wine/2026-08-08-example-gewurztraminer-2024.md");

    const result = await publishCapture({ capture, photo: null }, gateway);

    expect(result.contentPath).toBe(
      "content/wine/2026-08-08-example-gewurztraminer-2024-2.md",
    );
  });

  it("reuses a partial branch only when its capture trailer matches", async () => {
    const gateway = new FakeGateway();
    gateway.branchCaptureId = capture.captureId;

    await publishCapture({ capture, photo: null }, gateway);

    expect(gateway.committedBranch).toBeNull();
    expect(gateway.pullRequestInput).not.toBeNull();
  });

  it("rejects a branch owned by a different capture", async () => {
    const gateway = new FakeGateway();
    gateway.branchCaptureId = "capture-someone-else";

    await expect(publishCapture({ capture, photo: null }, gateway)).rejects.toMatchObject({
      code: "BRANCH_COLLISION",
      status: 409,
    });
    expect(gateway.pullRequestInput).toBeNull();
  });

  it("turns hostile titles into controlled paths", async () => {
    const gateway = new FakeGateway();
    const hostile: ValidatedCapture = {
      ...capture,
      wine: { ...capture.wine, title: "../../escape | Wine" },
    };

    const result = await publishCapture({ capture: hostile, photo: null }, gateway);

    expect(result.contentPath).toBe("content/wine/2026-08-08-escape-wine.md");
    expect(result.contentPath).not.toContain("..");
    expect(gateway.pullRequestInput?.body).not.toContain("| Wine | Wine");
  });
});
