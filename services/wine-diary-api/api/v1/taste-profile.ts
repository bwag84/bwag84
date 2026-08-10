import type { VercelRequest, VercelResponse } from "@vercel/node";

import { handleTasteProfile } from "../../src/read-app.js";

function requestHeaders(request: VercelRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

export default async function tasteProfile(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const host = request.headers.host ?? "localhost";
  const webRequest = new Request(
    `https://${host}${request.url ?? "/v1/taste-profile"}`,
    {
      method: request.method,
      headers: requestHeaders(request),
    },
  );
  const webResponse = await handleTasteProfile(webRequest);
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.status(webResponse.status).send(await webResponse.text());
}
