import { stringify } from "yaml";

import type { ValidatedCapture } from "./types.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_PATTERN = /^\/images\/wine\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

function safeProse(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderWineMarkdown(
  capture: ValidatedCapture,
  slug: string,
  featuredImage: string | null,
): string {
  if (!SLUG_PATTERN.test(slug)) throw new Error("Invalid wine slug");
  if (featuredImage !== null && !IMAGE_PATTERN.test(featuredImage)) {
    throw new Error("Invalid featured image path");
  }

  const frontMatter: Record<string, unknown> = {
    title: capture.wine.title,
    date: capture.wine.date,
    slug,
    producer: capture.wine.producer,
    vintage: capture.wine.vintage,
    country: capture.wine.country,
    region: capture.wine.region,
    grapes: capture.wine.grapes,
    rating: String(capture.wine.rating),
    verdict: capture.wine.verdict,
    would_buy_again: capture.wine.wouldBuyAgain,
    buy_again: capture.wine.buyAgain,
    status: capture.wine.status,
  };
  if (featuredImage !== null) frontMatter.featured_image = featuredImage;
  frontMatter.tags = capture.wine.tags;

  const sections = [
    `## First impression\n\n${safeProse(capture.review.firstImpression)}`,
    `## What I noticed\n\n${safeProse(capture.review.whatINoticed)}`,
    `## Verdict\n\n${safeProse(capture.review.verdict)}`,
  ];
  if (capture.review.context) {
    sections.push(`## Context\n\n${safeProse(capture.review.context)}`);
  }

  const yaml = stringify(frontMatter, {
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
    lineWidth: 0,
  }).trimEnd();

  return `---\n${yaml}\n---\n\n${sections.join("\n\n")}\n`;
}
