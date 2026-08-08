import { describe, expect, it, vi } from "vitest";

import { OctokitRepositoryGateway } from "../src/github.js";

function githubMock() {
  return {
    git: {
      getRef: vi.fn(),
      getCommit: vi.fn(),
      getTree: vi.fn(),
      createBlob: vi.fn(),
      createTree: vi.fn(),
      createCommit: vi.fn(),
      createRef: vi.fn(),
    },
    pulls: {
      list: vi.fn(),
      listFiles: vi.fn(),
      create: vi.fn(),
    },
  };
}

const repository = {
  token: "github-secret",
  owner: "bwag84",
  repo: "bwag84",
  baseBranch: "main",
};

describe("OctokitRepositoryGateway", () => {
  it("creates an atomic commit from blobs and one tree before creating the branch", async () => {
    const api = githubMock();
    api.git.getRef.mockResolvedValue({ data: { object: { sha: "base-commit" } } });
    api.git.getCommit.mockResolvedValue({ data: { tree: { sha: "base-tree" }, message: "base" } });
    api.git.createBlob
      .mockResolvedValueOnce({ data: { sha: "markdown-blob" } })
      .mockResolvedValueOnce({ data: { sha: "image-blob" } });
    api.git.createTree.mockResolvedValue({ data: { sha: "new-tree" } });
    api.git.createCommit.mockResolvedValue({ data: { sha: "new-commit" } });
    api.git.createRef.mockResolvedValue({ data: {} });
    const gateway = new OctokitRepositoryGateway(repository, api as never);

    await gateway.createAtomicCommitBranch(
      "wine-diary/example-abc123",
      [
        { path: "content/wine/example.md", content: Buffer.from("markdown") },
        { path: "static/images/wine/example.webp", content: Buffer.from("image") },
      ],
      "Add wine note\n\nWine-Capture-ID: capture-123",
    );

    expect(api.git.getRef).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      ref: "heads/main",
    });
    expect(api.git.createBlob).toHaveBeenNthCalledWith(1, {
      owner: "bwag84",
      repo: "bwag84",
      content: Buffer.from("markdown").toString("base64"),
      encoding: "base64",
    });
    expect(api.git.createTree).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      base_tree: "base-tree",
      tree: [
        { path: "content/wine/example.md", mode: "100644", type: "blob", sha: "markdown-blob" },
        { path: "static/images/wine/example.webp", mode: "100644", type: "blob", sha: "image-blob" },
      ],
    });
    expect(api.git.createCommit).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      message: "Add wine note\n\nWine-Capture-ID: capture-123",
      tree: "new-tree",
      parents: ["base-commit"],
    });
    expect(api.git.createRef).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      ref: "refs/heads/wine-diary/example-abc123",
      sha: "new-commit",
    });
  });

  it("finds an existing draft by its capture marker", async () => {
    const api = githubMock();
    api.pulls.list.mockResolvedValue({
      data: [
        {
          body: [
            "<!-- wine-capture-id: capture-123 -->",
            "<!-- wine-content-path: content/wine/example.md -->",
            "<!-- wine-image-path: static/images/wine/example.webp -->",
          ].join("\n"),
          html_url: "https://github.com/bwag84/bwag84/pull/7",
        },
      ],
    });
    const gateway = new OctokitRepositoryGateway(repository, api as never);

    await expect(gateway.findDraftByCaptureId("capture-123")).resolves.toEqual({
      status: "already_exists",
      captureId: "capture-123",
      pullRequestUrl: "https://github.com/bwag84/bwag84/pull/7",
      contentPath: "content/wine/example.md",
      imagePath: "static/images/wine/example.webp",
    });
  });

  it("collects existing and open-pull-request wine paths", async () => {
    const api = githubMock();
    api.git.getRef.mockResolvedValue({ data: { object: { sha: "base-commit" } } });
    api.git.getCommit.mockResolvedValue({ data: { tree: { sha: "base-tree" }, message: "base" } });
    api.git.getTree.mockResolvedValue({
      data: {
        tree: [
          { path: "content/wine/existing.md", type: "blob" },
          { path: "content/blog/not-wine.md", type: "blob" },
        ],
      },
    });
    api.pulls.list.mockResolvedValue({ data: [{ number: 9 }] });
    api.pulls.listFiles.mockResolvedValue({
      data: [
        { filename: "content/wine/pending.md" },
        { filename: "static/images/wine/pending.webp" },
      ],
    });
    const gateway = new OctokitRepositoryGateway(repository, api as never);

    await expect(gateway.listReservedContentPaths()).resolves.toEqual(
      new Set(["content/wine/existing.md", "content/wine/pending.md"]),
    );
  });

  it("distinguishes a missing branch, an unowned branch, and a matching trailer", async () => {
    const missingApi = githubMock();
    missingApi.git.getRef.mockRejectedValue({ status: 404 });
    const missing = new OctokitRepositoryGateway(repository, missingApi as never);
    await expect(missing.getBranchCaptureId("wine-diary/missing")).resolves.toBeNull();

    const unownedApi = githubMock();
    unownedApi.git.getRef.mockResolvedValue({ data: { object: { sha: "commit" } } });
    unownedApi.git.getCommit.mockResolvedValue({ data: { message: "ordinary commit" } });
    const unowned = new OctokitRepositoryGateway(repository, unownedApi as never);
    await expect(unowned.getBranchCaptureId("wine-diary/unowned")).resolves.toBe("");

    const ownedApi = githubMock();
    ownedApi.git.getRef.mockResolvedValue({ data: { object: { sha: "commit" } } });
    ownedApi.git.getCommit.mockResolvedValue({
      data: { message: "Add wine\n\nWine-Capture-ID: capture-123" },
    });
    const owned = new OctokitRepositoryGateway(repository, ownedApi as never);
    await expect(owned.getBranchCaptureId("wine-diary/owned")).resolves.toBe("capture-123");
  });

  it("creates a draft pull request against the configured base", async () => {
    const api = githubMock();
    api.pulls.create.mockResolvedValue({
      data: { html_url: "https://github.com/bwag84/bwag84/pull/12" },
    });
    const gateway = new OctokitRepositoryGateway(repository, api as never);

    const result = await gateway.createDraftPullRequest({
      branch: "wine-diary/example",
      title: "Add wine note: Example",
      body: "Draft body",
      draft: true,
    });

    expect(result).toEqual({ url: "https://github.com/bwag84/bwag84/pull/12" });
    expect(api.pulls.create).toHaveBeenCalledWith({
      owner: "bwag84",
      repo: "bwag84",
      head: "wine-diary/example",
      base: "main",
      title: "Add wine note: Example",
      body: "Draft body",
      draft: true,
    });
  });

  it("maps GitHub failures without leaking request credentials", async () => {
    const api = githubMock();
    api.pulls.list.mockRejectedValue({
      status: 500,
      request: { headers: { authorization: "token github-secret" } },
    });
    const gateway = new OctokitRepositoryGateway(repository, api as never);

    let caught: unknown;
    try {
      await gateway.findDraftByCaptureId("capture-123");
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "GITHUB_UNAVAILABLE", status: 502 });
    expect(String(caught)).not.toContain("github-secret");
  });
});
