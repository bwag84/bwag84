import { readFile } from "node:fs/promises";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const schemaPath = new URL(
  "../../../integrations/chatgpt-wine-diary/action.openapi.yaml",
  import.meta.url,
);

interface OpenApiDocument {
  openapi: string;
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: {
    securitySchemes: Record<string, Record<string, unknown>>;
    schemas: Record<string, Record<string, unknown>>;
  };
}

describe("Wine Diary GPT Action schema", () => {
  it("matches the authenticated consequential capture contract", async () => {
    const document = parse(await readFile(schemaPath, "utf8")) as OpenApiDocument;
    const operation = document.paths["/v1/captures"]?.post;
    const requestSchema = document.components.schemas.CaptureRequest;
    const wineSchema = document.components.schemas.WineInput;
    if (!operation || !requestSchema || !wineSchema) {
      throw new Error("Required Wine Diary Action schemas were not found");
    }
    const fileSchema = (requestSchema.properties as Record<string, Record<string, unknown>>)
      .openaiFileIdRefs;
    if (!fileSchema) throw new Error("openaiFileIdRefs schema was not found");
    const wineProperties = wineSchema.properties as Record<string, Record<string, unknown>>;
    if (!wineProperties.verdict || !wineProperties.rating) {
      throw new Error("Wine verdict or rating schema was not found");
    }

    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toHaveLength(1);
    expect(document.servers[0]?.url).toBe(
      "https://wine-diary-api.vercel.app",
    );
    expect(operation.operationId).toBe("createWineDraft");
    expect(operation["x-openai-isConsequential"]).toBe(true);
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(document.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(requestSchema.required).toEqual([
      "capture_id",
      "wine",
      "review",
      "openaiFileIdRefs",
    ]);
    expect(fileSchema.maxItems).toBe(1);
    expect(fileSchema.description).toContain("bottle photo");
    expect(wineProperties.verdict.enum).toEqual([
      "Class",
      "Pass",
      "Arse",
    ]);
    expect(wineProperties.rating).toMatchObject({
      type: "integer",
      minimum: 0,
      maximum: 100,
    });
    expect(Object.keys(operation.responses as object)).toEqual(
      expect.arrayContaining(["200", "201", "400", "401", "409", "502"]),
    );
  });

  it("keeps string enums intact for ChatGPT's YAML 1.1 parser", async () => {
    const document = parse(await readFile(schemaPath, "utf8"), {
      version: "1.1",
    }) as OpenApiDocument;
    const wineSchema = document.components.schemas.WineInput;
    if (!wineSchema) throw new Error("WineInput schema was not found");
    const wineProperties = wineSchema.properties as Record<
      string,
      Record<string, unknown>
    >;

    expect(wineProperties.would_buy_again?.enum).toEqual(["Yes", "No"]);
  });

  it("exposes authenticated non-consequential taste retrieval operations", async () => {
    const document = parse(await readFile(schemaPath, "utf8")) as OpenApiDocument;
    const profileOperation = document.paths["/v1/taste-profile"]?.get;
    const contextOperation = document.paths["/v1/taste-context"]?.post;
    const contextSchema = document.components.schemas.TasteContextRequest;
    const memorySchema = document.components.schemas.WineMemory;
    if (!profileOperation || !contextOperation || !contextSchema || !memorySchema) {
      throw new Error("Required personal taste retrieval schemas were not found");
    }

    expect(profileOperation.operationId).toBe("getTasteProfile");
    expect(profileOperation["x-openai-isConsequential"]).toBe(false);
    expect(profileOperation.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(profileOperation.responses as object)).toEqual(
      expect.arrayContaining(["200", "401", "405", "502"]),
    );

    expect(contextOperation.operationId).toBe("getTasteContext");
    expect(contextOperation["x-openai-isConsequential"]).toBe(false);
    expect(contextOperation.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(contextOperation.responses as object)).toEqual(
      expect.arrayContaining(["200", "400", "401", "405", "502"]),
    );

    expect(contextSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    const contextProperties = contextSchema.properties as Record<
      string,
      Record<string, unknown>
    >;
    expect(contextProperties.limit).toMatchObject({
      type: "integer",
      minimum: 1,
      maximum: 8,
      default: 5,
    });
    expect(memorySchema.required).toEqual(
      expect.arrayContaining([
        "id",
        "rating",
        "ratingLabel",
        "verdict",
        "wouldBuyAgain",
        "firstImpression",
        "whatINoticed",
        "context",
        "url",
      ]),
    );
  });
});
