import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalizeBottlePhoto } from "../src/image.js";
import type { OpenAIFileRef } from "../src/types.js";

const fileRef: OpenAIFileRef = {
  name: "bottle.jpeg",
  id: "file-123",
  mime_type: "image/jpeg",
  download_link: "https://files.oaiusercontent.com/file-123",
};

async function sourceImage(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2_400,
      height: 1_200,
      channels: 3,
      background: "#7f1d1d",
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

function fetching(
  body: BodyInit | Buffer,
  headers: HeadersInit = { "content-type": "image/jpeg" },
): typeof fetch {
  return async () => new Response(body as BodyInit, { status: 200, headers });
}

describe("normalizeBottlePhoto", () => {
  it("orients, resizes, converts, and strips metadata", async () => {
    const output = await normalizeBottlePhoto(fileRef, {
      fetchImpl: fetching(await sourceImage()),
    });
    const metadata = await sharp(output).metadata();

    expect(metadata.format).toBe("webp");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBeLessThanOrEqual(1_600);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("does not enlarge small images", async () => {
    const small = await sharp({
      create: { width: 320, height: 640, channels: 3, background: "#f5f5f4" },
    }).png().toBuffer();

    const output = await normalizeBottlePhoto(
      { ...fileRef, name: "bottle.png", mime_type: "image/png" },
      { fetchImpl: fetching(small, { "content-type": "image/png" }) },
    );
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(640);
  });

  it("rejects non-HTTPS download links", async () => {
    await expect(
      normalizeBottlePhoto({ ...fileRef, download_link: "http://files.oaiusercontent.com/file" }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });

  it("rejects download links outside allowed OpenAI hosts", async () => {
    await expect(
      normalizeBottlePhoto({ ...fileRef, download_link: "https://attacker.example/file" }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });

  it("rejects suffix-confusion hostnames", async () => {
    await expect(
      normalizeBottlePhoto({
        ...fileRef,
        download_link: "https://files.oaiusercontent.com.attacker.example/file",
      }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });

  it("rejects unsupported declared MIME types before fetching", async () => {
    let fetched = false;
    await expect(
      normalizeBottlePhoto(
        { ...fileRef, mime_type: "application/pdf" },
        { fetchImpl: async () => { fetched = true; return new Response(); } },
      ),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
    expect(fetched).toBe(false);
  });

  it("rejects an oversized declared response", async () => {
    await expect(
      normalizeBottlePhoto(fileRef, {
        maxBytes: 16,
        fetchImpl: fetching("small body", {
          "content-type": "image/jpeg",
          "content-length": "32",
        }),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });

  it("rejects an oversized actual response", async () => {
    await expect(
      normalizeBottlePhoto(fileRef, {
        maxBytes: 8,
        fetchImpl: fetching("larger than eight bytes"),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });

  it("maps an expired temporary link to a recoverable error", async () => {
    await expect(
      normalizeBottlePhoto(fileRef, {
        fetchImpl: async () => new Response("expired", { status: 403 }),
      }),
    ).rejects.toMatchObject({ code: "PHOTO_EXPIRED", status: 400 });
  });

  it("maps download failures without exposing the temporary URL", async () => {
    let caught: unknown;
    try {
      await normalizeBottlePhoto(fileRef, {
        fetchImpl: async () => { throw new Error(`failed ${fileRef.download_link}`); },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ code: "PHOTO_UNAVAILABLE" });
    expect(String(caught)).not.toContain(fileRef.download_link);
  });

  it("rejects malformed image bytes", async () => {
    await expect(
      normalizeBottlePhoto(fileRef, { fetchImpl: fetching("not an image") }),
    ).rejects.toMatchObject({ code: "PHOTO_REJECTED" });
  });
});
