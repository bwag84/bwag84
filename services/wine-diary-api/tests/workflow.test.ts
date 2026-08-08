import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type WorkflowStep = {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};

type WorkflowJob = {
  defaults?: { run?: { "working-directory"?: string } };
  steps?: WorkflowStep[];
};

type Workflow = {
  on?: { pull_request?: { paths?: string[] } };
  permissions?: { contents?: string };
  jobs?: Record<string, WorkflowJob>;
};

describe("wine draft validation workflow", () => {
  it("validates both the capture service and the Hugo site on relevant pull requests", async () => {
    const workflowPath = resolve(
      process.cwd(),
      "../../.github/workflows/validate-wine-draft.yml",
    );
    const workflow = parse(await readFile(workflowPath, "utf8")) as Workflow;

    expect(workflow.on?.pull_request?.paths).toEqual(
      expect.arrayContaining([
        "content/wine/**",
        "static/images/wine/**",
        "layouts/wine/**",
        "services/wine-diary-api/**",
        "integrations/chatgpt-wine-diary/**",
      ]),
    );
    expect(workflow.permissions).toEqual({ contents: "read" });

    const api = workflow.jobs?.api;
    expect(api?.defaults?.run?.["working-directory"]).toBe(
      "services/wine-diary-api",
    );
    expect(api?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ run: "npm ci" }),
        expect.objectContaining({ run: "npm test" }),
        expect.objectContaining({ run: "npm run typecheck" }),
      ]),
    );

    const nodeSteps = Object.values(workflow.jobs ?? {}).flatMap(
      (job) => job.steps ?? [],
    );
    expect(
      nodeSteps
        .filter((step) => step.uses?.startsWith("actions/setup-node@"))
        .every((step) => step.with?.["node-version"] === 24),
    ).toBe(true);

    const hugo = workflow.jobs?.hugo;
    expect(hugo?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ run: "bash tests/hugo-wine-verdict.sh" }),
        expect.objectContaining({ run: "npm run build" }),
      ]),
    );
    expect(
      hugo?.steps?.some((step) => step.run?.includes("hugo_extended_0.128.0")),
    ).toBe(true);
  });
});
