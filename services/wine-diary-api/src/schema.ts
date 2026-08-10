import { z } from "zod";

import type { ValidatedCapture } from "./types.js";

const trimmed = (maximum: number) => z.string().trim().max(maximum);
const requiredProse = z.string().trim().min(1).max(6_000);

const wineSchema = z
  .object({
    title: trimmed(240).pipe(z.string().min(1)),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    producer: trimmed(240),
    vintage: trimmed(40),
    country: trimmed(120),
    region: trimmed(160),
    grapes: z.array(trimmed(120).pipe(z.string().min(1))).max(20),
    rating: z.number().int().min(0).max(100),
    verdict: z.enum(["Class", "Pass", "Arse"]),
    would_buy_again: z.enum(["Yes", "No"]),
    status: z.enum(["drunk", "benchmark"]),
    tags: z.array(trimmed(80).pipe(z.string().min(1))).max(30),
  })
  .strict();

const reviewSchema = z
  .object({
    first_impression: requiredProse,
    what_i_noticed: requiredProse,
    verdict: requiredProse,
    context: z.string().trim().max(6_000).optional(),
  })
  .strict();

const fileSchema = z
  .object({
    name: trimmed(255).pipe(z.string().min(1)),
    id: trimmed(255).pipe(z.string().min(1)),
    mime_type: trimmed(120).pipe(z.string().min(1)),
    download_link: z.string().url(),
  })
  .strict();

const captureSchema = z
  .object({
    capture_id: z
      .string()
      .trim()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
    wine: wineSchema,
    review: reviewSchema,
    openaiFileIdRefs: z.array(fileSchema).max(1).default([]),
  })
  .strict();

function amsterdamDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function parseCaptureRequest(value: unknown, now = new Date()): ValidatedCapture {
  const parsed = captureSchema.parse(value);
  if (!isCalendarDate(parsed.wine.date)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["wine", "date"],
        message: "Tasting date must be a real calendar date",
        input: parsed.wine.date,
      },
    ]);
  }
  if (parsed.wine.date > amsterdamDate(now)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["wine", "date"],
        message: "Tasting date cannot be in the future",
        input: parsed.wine.date,
      },
    ]);
  }

  return {
    captureId: parsed.capture_id,
    wine: {
      title: parsed.wine.title,
      date: parsed.wine.date,
      producer: parsed.wine.producer,
      vintage: parsed.wine.vintage,
      country: parsed.wine.country,
      region: parsed.wine.region,
      grapes: parsed.wine.grapes,
      rating: parsed.wine.rating,
      verdict: parsed.wine.verdict,
      wouldBuyAgain: parsed.wine.would_buy_again,
      buyAgain: parsed.wine.would_buy_again === "Yes",
      status: parsed.wine.status,
      tags: parsed.wine.tags,
    },
    review: {
      firstImpression: parsed.review.first_impression,
      whatINoticed: parsed.review.what_i_noticed,
      verdict: parsed.review.verdict,
      context: parsed.review.context?.trim() || null,
    },
    file: parsed.openaiFileIdRefs[0] ?? null,
  };
}
