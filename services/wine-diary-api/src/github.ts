import { Octokit } from "@octokit/rest";

import {
  AppError,
  type DraftPullRequestInput,
  type PublishResult,
  type RepositoryFile,
  type RepositoryGateway,
} from "./types.js";

interface RepositoryConfiguration {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
}

type OctokitApi = Pick<Octokit, "git" | "pulls">;

const REPOSITORY_FILE_PATTERN = /^(?:content\/wine\/[a-z0-9-]+\.md|static\/images\/wine\/[a-z0-9-]+\.webp)$/;

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function githubUnavailable(): AppError {
  return new AppError(
    "GITHUB_UNAVAILABLE",
    502,
    "GitHub is temporarily unavailable. Please retry this capture.",
  );
}

function marker(body: string, name: string): string | null {
  const expression = new RegExp(`<!-- ${name}: ([^\\n]+) -->`);
  return expression.exec(body)?.[1]?.trim() ?? null;
}

export class OctokitRepositoryGateway implements RepositoryGateway {
  private readonly api: OctokitApi;

  public constructor(
    private readonly configuration: RepositoryConfiguration,
    api?: OctokitApi,
  ) {
    this.api = api ?? new Octokit({ auth: configuration.token });
  }

  private coordinates(): { owner: string; repo: string } {
    return {
      owner: this.configuration.owner,
      repo: this.configuration.repo,
    };
  }

  private async openPullRequests() {
    try {
      return await this.api.pulls.list({
        ...this.coordinates(),
        state: "open",
        per_page: 100,
      });
    } catch {
      throw githubUnavailable();
    }
  }

  private async baseCommit(): Promise<{ commitSha: string; treeSha: string }> {
    try {
      const reference = await this.api.git.getRef({
        ...this.coordinates(),
        ref: `heads/${this.configuration.baseBranch}`,
      });
      const commitSha = reference.data.object.sha;
      const commit = await this.api.git.getCommit({
        ...this.coordinates(),
        commit_sha: commitSha,
      });
      return { commitSha, treeSha: commit.data.tree.sha };
    } catch {
      throw githubUnavailable();
    }
  }

  public async findDraftByCaptureId(captureId: string): Promise<PublishResult | null> {
    const pulls = await this.openPullRequests();
    for (const pull of pulls.data) {
      const body = pull.body ?? "";
      if (marker(body, "wine-capture-id") !== captureId) continue;
      const savedContentPath = marker(body, "wine-content-path");
      if (!savedContentPath) throw githubUnavailable();
      const savedImagePath = marker(body, "wine-image-path");
      return {
        status: "already_exists",
        captureId,
        pullRequestUrl: pull.html_url,
        contentPath: savedContentPath,
        imagePath: savedImagePath && savedImagePath !== "none" ? savedImagePath : null,
      };
    }
    return null;
  }

  public async listReservedContentPaths(): Promise<Set<string>> {
    const reserved = new Set<string>();
    try {
      const base = await this.baseCommit();
      const tree = await this.api.git.getTree({
        ...this.coordinates(),
        tree_sha: base.treeSha,
        recursive: "true",
      });
      if (tree.data.truncated) throw githubUnavailable();
      for (const item of tree.data.tree) {
        if (item.type === "blob" && item.path?.startsWith("content/wine/") && item.path.endsWith(".md")) {
          reserved.add(item.path);
        }
      }

      const pulls = await this.openPullRequests();
      for (const pull of pulls.data) {
        const files = await this.api.pulls.listFiles({
          ...this.coordinates(),
          pull_number: pull.number,
          per_page: 100,
        });
        for (const file of files.data) {
          if (file.filename.startsWith("content/wine/") && file.filename.endsWith(".md")) {
            reserved.add(file.filename);
          }
        }
      }
      return reserved;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw githubUnavailable();
    }
  }

  public async getBranchCaptureId(branch: string): Promise<string | null> {
    try {
      const reference = await this.api.git.getRef({
        ...this.coordinates(),
        ref: `heads/${branch}`,
      });
      const commit = await this.api.git.getCommit({
        ...this.coordinates(),
        commit_sha: reference.data.object.sha,
      });
      return /^Wine-Capture-ID: ([A-Za-z0-9][A-Za-z0-9._-]*)$/m.exec(
        commit.data.message,
      )?.[1] ?? "";
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw githubUnavailable();
    }
  }

  public async createAtomicCommitBranch(
    branch: string,
    files: RepositoryFile[],
    message: string,
  ): Promise<void> {
    if (files.length === 0 || files.some((file) => !REPOSITORY_FILE_PATTERN.test(file.path))) {
      throw new AppError("INVALID_REPOSITORY_PATH", 400, "A generated repository path was invalid.");
    }

    try {
      const base = await this.baseCommit();
      const blobs = await Promise.all(
        files.map((file) =>
          this.api.git.createBlob({
            ...this.coordinates(),
            content: file.content.toString("base64"),
            encoding: "base64",
          }),
        ),
      );
      const tree = await this.api.git.createTree({
        ...this.coordinates(),
        base_tree: base.treeSha,
        tree: files.map((file, index) => ({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blobs[index]?.data.sha,
        })),
      });
      const commit = await this.api.git.createCommit({
        ...this.coordinates(),
        message,
        tree: tree.data.sha,
        parents: [base.commitSha],
      });
      await this.api.git.createRef({
        ...this.coordinates(),
        ref: `refs/heads/${branch}`,
        sha: commit.data.sha,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw githubUnavailable();
    }
  }

  public async createDraftPullRequest(input: DraftPullRequestInput): Promise<{ url: string }> {
    try {
      const pull = await this.api.pulls.create({
        ...this.coordinates(),
        head: input.branch,
        base: this.configuration.baseBranch,
        title: input.title,
        body: input.body,
        draft: true,
      });
      return { url: pull.data.html_url };
    } catch {
      throw githubUnavailable();
    }
  }
}
