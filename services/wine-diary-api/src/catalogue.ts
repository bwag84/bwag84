import { Octokit } from "@octokit/rest";

import { AppError } from "./types.js";
import {
  parseWineCatalogue,
  type PublishedWineFile,
  type WineMemory,
} from "./wine-memory.js";

interface RepositoryConfiguration {
  token: string;
  owner: string;
  repo: string;
  baseBranch: string;
}

type OctokitApi = Pick<Octokit, "git">;

export interface WineCatalogueSource {
  getBaseCommitSha(): Promise<string>;
  readPublishedWineFiles(commitSha: string): Promise<PublishedWineFile[]>;
}

export interface WineCatalogueReader {
  read(): Promise<WineMemory[]>;
}

const PUBLISHED_WINE_PATH = /^content\/wine\/[^/]+\.md$/;

function historyUnavailable(options?: ErrorOptions): AppError {
  return new AppError(
    "HISTORY_UNAVAILABLE",
    502,
    "The published wine history is temporarily unavailable. Please retry.",
    options,
  );
}

export class GitHubWineCatalogueSource implements WineCatalogueSource {
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

  public async getBaseCommitSha(): Promise<string> {
    try {
      const reference = await this.api.git.getRef({
        ...this.coordinates(),
        ref: `heads/${this.configuration.baseBranch}`,
      });
      return reference.data.object.sha;
    } catch (error) {
      throw historyUnavailable({ cause: error });
    }
  }

  public async readPublishedWineFiles(commitSha: string): Promise<PublishedWineFile[]> {
    try {
      const commit = await this.api.git.getCommit({
        ...this.coordinates(),
        commit_sha: commitSha,
      });
      const tree = await this.api.git.getTree({
        ...this.coordinates(),
        tree_sha: commit.data.tree.sha,
        recursive: "true",
      });
      if (tree.data.truncated) throw new Error("GitHub returned a truncated repository tree");

      const blobs = tree.data.tree
        .filter(
          (entry): entry is typeof entry & { path: string; sha: string } =>
            entry.type === "blob" &&
            typeof entry.path === "string" &&
            typeof entry.sha === "string" &&
            PUBLISHED_WINE_PATH.test(entry.path) &&
            entry.path !== "content/wine/_index.md",
        )
        .sort((left, right) => left.path.localeCompare(right.path));

      return await Promise.all(
        blobs.map(async ({ path, sha }) => {
          const blob = await this.api.git.getBlob({
            ...this.coordinates(),
            file_sha: sha,
          });
          if (blob.data.encoding !== "base64") {
            throw new Error(`Unsupported GitHub blob encoding for ${path}`);
          }
          return {
            path,
            markdown: Buffer.from(blob.data.content, "base64").toString("utf8"),
          };
        }),
      );
    } catch (error) {
      if (error instanceof AppError && error.code === "HISTORY_UNAVAILABLE") throw error;
      throw historyUnavailable({ cause: error });
    }
  }
}

export function createWineCatalogueReader(
  source: WineCatalogueSource,
  siteOrigin = "https://bartwagener.com",
): WineCatalogueReader {
  let cachedSha: string | null = null;
  let cachedWines: WineMemory[] | null = null;
  let inFlight: { sha: string; promise: Promise<WineMemory[]> } | null = null;

  return {
    async read(): Promise<WineMemory[]> {
      try {
        const sha = await source.getBaseCommitSha();
        if (cachedSha === sha && cachedWines !== null) return cachedWines;
        if (inFlight?.sha === sha) return inFlight.promise;

        const promise = source
          .readPublishedWineFiles(sha)
          .then((files) => parseWineCatalogue(files, siteOrigin))
          .then((wines) => {
            cachedSha = sha;
            cachedWines = wines;
            return wines;
          })
          .catch((error: unknown) => {
            if (error instanceof AppError && error.code === "HISTORY_UNAVAILABLE") throw error;
            throw historyUnavailable({ cause: error });
          })
          .finally(() => {
            if (inFlight?.sha === sha) inFlight = null;
          });

        inFlight = { sha, promise };
        return promise;
      } catch (error) {
        if (error instanceof AppError && error.code === "HISTORY_UNAVAILABLE") throw error;
        throw historyUnavailable({ cause: error });
      }
    },
  };
}
