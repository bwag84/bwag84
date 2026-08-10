import { createHash } from "node:crypto";

const MAX_SLUG_LENGTH = 72;

export function slugifyWineTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  if (!slug) throw new Error("Wine title does not produce a usable slug");
  return slug;
}

export function captureIdSuffix(captureId: string): string {
  return createHash("sha256").update(captureId, "utf8").digest("hex").slice(0, 12);
}

export function withNumericSuffix(slug: string, ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new Error("Slug collision ordinal must be a positive integer");
  }
  return ordinal === 1 ? slug : `${slug}-${ordinal}`;
}

function assertDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid content date");
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid wine slug");
}

export function contentPath(date: string, slug: string): string {
  assertDate(date);
  assertSlug(slug);
  return `content/wine/${date}-${slug}.md`;
}

export function imagePath(date: string, slug: string): string {
  assertDate(date);
  assertSlug(slug);
  return `static/images/wine/${date}-${slug}.webp`;
}
