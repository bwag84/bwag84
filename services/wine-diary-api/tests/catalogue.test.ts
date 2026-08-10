import { describe, expect, it, vi } from "vitest";

import {
  createWineCatalogueReader,
  GitHubWineCatalogueSource,
} from "../src/catalogue.js";

const repository = {
  token: "github-secret",
  owner: "bwag84",
  repo: "bwag84",
  baseBranch: "main",
};

function markdown(title: string, date: string, slug: string): string {
  return `---\ntitle: ${title}\ndate: ${date}\nslug: ${slug}\nstatus: drunk\n---\n`;
}

describe("wine catalogue", () => {
  it("reuses parsed wine memories while the base commit SHA is unchanged", async () => {
    const source = {
      getBaseCommitSha: vi.fn().mockResolvedValue("sha-1"),
      readPublishedWineFiles: vi.fn().mockResolvedValue([
        {
          path: "content/wine/2026-01-01-one.md",
          markdown: markdown("One", "2026-01-01", "one"),
        },
      ]),
    };
    const reader = createWineCatalogueReader(source);

    const first = await reader.read();
    const second = await reader.read();

    expect(second).toBe(first);
    expect(source.getBaseCommitSha).toHaveBeenCalledTimes(2);
    expect(source.readPublishedWineFiles).toHaveBeenCalledTimes(1);
  });

  it("reloads after the published base commit changes", async () => {
    const source = {
      getBaseCommitSha: vi
        .fn()
        .mockResolvedValueOnce("sha-1")
        .mockResolvedValueOnce("sha-2"),
      readPublishedWineFiles: vi
        .fn()
        .mockResolvedValueOnce([
          {
            path: "content/wine/2026-01-01-one.md",
            markdown: markdown("One", "2026-01-01", "one"),
          },
        ])
        .mockResolvedValueOnce([
          {
            path: "content/wine/2026-01-02-two.md",
            markdown: markdown("Two", "2026-01-02", "two"),
          },
        ]),
    };
    const reader = createWineCatalogueReader(source);

    expect((await reader.read())[0]?.title).toBe("One");
    expect((await reader.read())[0]?.title).toBe("Two");
    expect(source.readPublishedWineFiles).toHaveBeenNthCalledWith(1, "sha-1");
    expect(source.readPublishedWineFiles).toHaveBeenNthCalledWith(2, "sha-2");
  });

  it("shares an in-flight load for simultaneous reads of the same commit", async () => {
    let resolveFiles: ((files: Array<{ path: string; markdown: string }>) => void) | undefined;
    const source = {
      getBaseCommitSha: vi.fn().mockResolvedValue("sha-1"),
      readPublishedWineFiles: vi.fn().mockImplementation(
        () =>
          new Promise<Array<{ path: string; markdown: string }>>((resolve) => {
            resolveFiles = resolve;
          }),
      ),
    };
    const reader = createWineCatalogueReader(source);

    const first = reader.read();
    const second = reader.read();
    await vi.waitFor(() => expect(source.readPublishedWineFiles).toHaveBeenCalledTimes(1));
    resolveFiles?.([
      {
        path: "content/wine/2026-01-01-one.md",
        markdown: markdown("One", "2026-01-01", "one"),
      },
    ]);

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(secondResult).toBe(firstResult);
  });

  it("loads only published wine Markdown blobs", async () => {
    const api = {
      git: {
        getRef: vi.fn().mockResolvedValue({
          data: { object: { sha: "commit" } },
        }),
        getCommit: vi.fn().mockResolvedValue({
          data: { tree: { sha: "tree" } },
        }),
        getTree: vi.fn().mockResolvedValue({
          data: {
            tree: [
              { path: "content/wine/one.md", type: "blob", sha: "blob-one" },
              { path: "content/wine/_index.md", type: "blob", sha: "blob-index" },
              { path: "content/wine/archive/two.md", type: "blob", sha: "blob-two" },
              { path: "content/blog/no.md", type: "blob", sha: "blob-no" },
            ],
          },
        }),
        getBlob: vi.fn().mockResolvedValue({
          data: {
            encoding: "base64",
            content: Buffer.from("---\ntitle: One\n---\n").toString("base64"),
          },
        }),
      },
    };
    const source = new GitHubWineCatalogueSource(repository, api as never);

    await expect(source.getBaseCommitSha()).resolves.toBe("commit");
    await expect(source.readPublishedWineFiles("commit")).resolves.toEqual([
      {
        path: "content/wine/one.md",
        markdown: "---\ntitle: One\n---\n",
      },
    ]);
    expect(api.git.getRef).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      ref: "heads/main",
    });
    expect(api.git.getTree).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      tree_sha: "tree",
      recursive: "true",
    });
    expect(api.git.getBlob).toHaveBeenCalledTimes(1);
  });

  it("maps GitHub failures without leaking credentials", async () => {
    const api = {
      git: {
        getRef: vi.fn().mockRejectedValue({
          status: 500,
          request: { headers: { authorization: "token github-secret" } },
        }),
      },
    };
    const source = new GitHubWineCatalogueSource(repository, api as never);

    let caught: unknown;
    try {
      await source.getBaseCommitSha();
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "HISTORY_UNAVAILABLE", status: 502 });
    expect(String(caught)).not.toContain("github-secret");
  });
});
