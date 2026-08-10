import sharp from "sharp";

import { AppError, type OpenAIFileRef } from "./types.js";

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface ImageOptions {
  maxBytes?: number;
  maxDimension?: number;
  quality?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  allowedHostSuffixes?: string[];
}

function rejectsHost(hostname: string, suffixes: string[]): boolean {
  const host = hostname.toLowerCase();
  return !suffixes.some((suffix) => {
    const normalized = suffix.toLowerCase();
    const root = normalized.startsWith(".") ? normalized.slice(1) : normalized;
    return host === root || host.endsWith(normalized.startsWith(".") ? normalized : `.${normalized}`);
  });
}

function validateDownloadUrl(downloadLink: string, suffixes: string[]): URL {
  let url: URL;
  try {
    url = new URL(downloadLink);
  } catch {
    throw new AppError("PHOTO_REJECTED", 400, "The bottle photo link is invalid.");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    rejectsHost(url.hostname, suffixes)
  ) {
    throw new AppError("PHOTO_REJECTED", 400, "The bottle photo link is not trusted.");
  }
  return url;
}

export async function normalizeBottlePhoto(
  file: OpenAIFileRef,
  options: ImageOptions = {},
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  const maxDimension = options.maxDimension ?? 1_600;
  const quality = options.quality ?? 82;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const allowedHostSuffixes = options.allowedHostSuffixes ?? [".oaiusercontent.com"];

  if (!SUPPORTED_MIME_TYPES.has(file.mime_type.toLowerCase())) {
    throw new AppError("PHOTO_REJECTED", 400, "The uploaded file is not a supported still image.");
  }
  const url = validateDownloadUrl(file.download_link, allowedHostSuffixes);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AppError(
      "PHOTO_UNAVAILABLE",
      502,
      "The bottle photo could not be downloaded. Please try again.",
      { cause: error },
    );
  }

  if ([401, 403, 404, 410].includes(response.status)) {
    throw new AppError(
      "PHOTO_EXPIRED",
      400,
      "The temporary bottle photo link expired. Please attach the photo again.",
    );
  }
  if (!response.ok) {
    throw new AppError(
      "PHOTO_UNAVAILABLE",
      502,
      "The bottle photo service is temporarily unavailable. Please try again.",
    );
  }
  if (response.url) validateDownloadUrl(response.url, allowedHostSuffixes);

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError("PHOTO_REJECTED", 400, "The bottle photo exceeds the 20 MiB limit.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) {
    throw new AppError("PHOTO_REJECTED", 400, "The bottle photo exceeds the 20 MiB limit.");
  }

  try {
    return await sharp(bytes, { animated: false, failOn: "warning" })
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  } catch (error) {
    throw new AppError(
      "PHOTO_REJECTED",
      400,
      "The bottle photo could not be decoded as a supported still image.",
      { cause: error },
    );
  }
}
