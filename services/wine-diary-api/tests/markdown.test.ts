import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";

import { renderWineMarkdown } from "../src/markdown.js";
import type { ValidatedCapture } from "../src/types.js";

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

function frontMatter(markdown: string): Record<string, unknown> {
  const match = /^---\n([\s\S]+?)\n---\n/.exec(markdown);
  if (!match?.[1]) throw new Error("Front matter was not found");
  return parseYaml(match[1]) as Record<string, unknown>;
}

describe("renderWineMarkdown", () => {
  it("serializes the complete front-matter contract", () => {
    const markdown = renderWineMarkdown(
      capture,
      "example-gewurztraminer-2024",
      "/images/wine/2026-08-08-example-gewurztraminer-2024.webp",
    );

    expect(frontMatter(markdown)).toEqual({
      title: "Example Gewürztraminer 2024",
      date: "2026-08-08",
      slug: "example-gewurztraminer-2024",
      producer: "Example Producer",
      vintage: "2024",
      country: "France",
      region: "Alsace",
      grapes: ["Gewürztraminer"],
      rating: "84",
      verdict: "Pass",
      would_buy_again: "No",
      buy_again: false,
      status: "drunk",
      featured_image: "/images/wine/2026-08-08-example-gewurztraminer-2024.webp",
      tags: ["white", "Alsace"],
    });
  });

  it("renders required headings in their fixed order", () => {
    const markdown = renderWineMarkdown(capture, "example-wine", null);
    const first = markdown.indexOf("## First impression");
    const noticed = markdown.indexOf("## What I noticed");
    const verdict = markdown.indexOf("## Verdict");
    const context = markdown.indexOf("## Context");

    expect(first).toBeGreaterThan(0);
    expect(noticed).toBeGreaterThan(first);
    expect(verdict).toBeGreaterThan(noticed);
    expect(context).toBeGreaterThan(verdict);
  });

  it("omits Context and featured_image when neither is supplied", () => {
    const withoutContext: ValidatedCapture = {
      ...capture,
      review: { ...capture.review, context: null },
    };

    const markdown = renderWineMarkdown(withoutContext, "example-wine", null);

    expect(markdown).not.toContain("## Context");
    expect(frontMatter(markdown)).not.toHaveProperty("featured_image");
  });

  it("escapes raw HTML while preserving normal Markdown punctuation", () => {
    const hostile: ValidatedCapture = {
      ...capture,
      review: {
        ...capture.review,
        firstImpression: "Bright <script>alert('x')</script> and **bold**.",
      },
    };

    const markdown = renderWineMarkdown(hostile, "example-wine", null);

    expect(markdown).not.toContain("<script>");
    expect(markdown).toContain("&lt;script&gt;alert('x')&lt;/script&gt;");
    expect(markdown).toContain("**bold**");
  });

  it("normalizes line endings and excessive blank lines", () => {
    const untidy: ValidatedCapture = {
      ...capture,
      review: {
        ...capture.review,
        whatINoticed: "First line.\r\n\r\n\r\nSecond line.",
      },
    };

    const markdown = renderWineMarkdown(untidy, "example-wine", null);

    expect(markdown).not.toContain("\r");
    expect(markdown).not.toContain("\n\n\n");
  });

  it("rejects model-controlled or malformed repository paths", () => {
    expect(() => renderWineMarkdown(capture, "../../escape", null)).toThrow(/slug/i);
    expect(() =>
      renderWineMarkdown(capture, "example-wine", "https://attacker.example/bottle.webp"),
    ).toThrow(/image path/i);
  });
});
