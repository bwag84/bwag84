import type { VercelRequest, VercelResponse } from "@vercel/node";

import { handleTasteContext } from "../../src/read-app.js";

function requestHeaders(request: VercelRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(name, value.join(", "));
    else if (value !== undefined) headers.set(name, value);
  }
  return headers;
}

function requestBody(request: VercelRequest): BodyInit | undefined {
  if (request.body === undefined || request.body === null) return undefined;
  if (typeof request.body === "string" || request.body instanceof Uint8Array) {
    return request.body as BodyInit;
  }
  return JSON.stringify(request.body);
}

export default async function tasteContext(
  request: VercelRequest,
  response: VercelResponse,
): Promise<void> {
  const host = request.headers.host ?? "localhost";
  const webRequest = new Request(
    `https://${host}${request.url ?? "/v1/taste-context"}`,
    {
      method: request.method,
      headers: requestHeaders(request),
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : requestBody(request),
    },
  );
  const webResponse = await handleTasteContext(webRequest);
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.status(webResponse.status).send(await webResponse.text());
}
