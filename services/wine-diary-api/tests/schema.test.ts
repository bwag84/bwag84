import { describe, expect, it } from "vitest";

import { parseCaptureRequest } from "../src/schema.js";

const now = new Date("2026-08-08T12:00:00Z");

const validCapture = {
  capture_id: "capture-20260808-abc123",
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
    would_buy_again: "No",
    status: "drunk",
    tags: ["white", "Alsace"],
  },
  review: {
    first_impression: "Aromatic and generous.",
    what_i_noticed: "Rose, lychee and spice.",
    verdict: "84/100. A Pass in the right setting.",
    context: "Excellent with white fish but medicinal on its own.",
  },
  openaiFileIdRefs: [],
};

describe("parseCaptureRequest", () => {
  it("normalizes a complete valid capture", () => {
    const result = parseCaptureRequest(validCapture, now);

    expect(result.captureId).toBe("capture-20260808-abc123");
    expect(result.wine.verdict).toBe("Pass");
    expect(result.wine.buyAgain).toBe(false);
    expect(result.review.context).toContain("white fish");
    expect(result.file).toBeNull();
  });

  it.each(["Excellent", "PASS", "class", ""]) (
    "rejects invalid verdict %j",
    (verdict) => {
      expect(() =>
        parseCaptureRequest(
          { ...validCapture, wine: { ...validCapture.wine, verdict } },
          now,
        ),
      ).toThrow();
    },
  );

  it.each([-1, 101, 84.5, Number.NaN])("rejects invalid rating %j", (rating) => {
    expect(() =>
      parseCaptureRequest(
        { ...validCapture, wine: { ...validCapture.wine, rating } },
        now,
      ),
    ).toThrow();
  });

  it("rejects a future tasting date in Europe/Amsterdam", () => {
    expect(() =>
      parseCaptureRequest(
        { ...validCapture, wine: { ...validCapture.wine, date: "2026-08-09" } },
        now,
      ),
    ).toThrow(/future/i);
  });

  it.each(["Maybe", "yes", true])("rejects invalid buy-again value %j", (value) => {
    expect(() =>
      parseCaptureRequest(
        { ...validCapture, wine: { ...validCapture.wine, would_buy_again: value } },
        now,
      ),
    ).toThrow();
  });

  it("accepts one uploaded image reference", () => {
    const file = {
      name: "bottle.jpeg",
      id: "file-123",
      mime_type: "image/jpeg",
      download_link: "https://files.oaiusercontent.com/file-123",
    };

    const result = parseCaptureRequest(
      { ...validCapture, openaiFileIdRefs: [file] },
      now,
    );

    expect(result.file).toEqual(file);
  });

  it("rejects more than one uploaded file", () => {
    const file = {
      name: "bottle.jpeg",
      id: "file-123",
      mime_type: "image/jpeg",
      download_link: "https://files.oaiusercontent.com/file-123",
    };

    expect(() =>
      parseCaptureRequest(
        { ...validCapture, openaiFileIdRefs: [file, { ...file, id: "file-456" }] },
        now,
      ),
    ).toThrow();
  });

  it.each(["first_impression", "what_i_noticed", "verdict"] as const)(
    "rejects missing required review field %s",
    (field) => {
      const review = { ...validCapture.review };
      delete review[field];

      expect(() => parseCaptureRequest({ ...validCapture, review }, now)).toThrow();
    },
  );

  it("allows confirmed unknown factual values", () => {
    const result = parseCaptureRequest(
      {
        ...validCapture,
        wine: {
          ...validCapture.wine,
          producer: "",
          vintage: "",
          country: "",
          region: "",
          grapes: [],
        },
      },
      now,
    );

    expect(result.wine.grapes).toEqual([]);
    expect(result.wine.region).toBe("");
  });

  it("rejects unknown top-level fields", () => {
    expect(() =>
      parseCaptureRequest({ ...validCapture, repository_path: "/tmp/escape" }, now),
    ).toThrow();
  });

  it("trims strings and drops an empty optional context", () => {
    const result = parseCaptureRequest(
      {
        ...validCapture,
        wine: { ...validCapture.wine, title: "  Example Wine  " },
        review: { ...validCapture.review, context: "   " },
      },
      now,
    );

    expect(result.wine.title).toBe("Example Wine");
    expect(result.review.context).toBeNull();
  });
});
