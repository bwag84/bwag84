import { readFile, readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseWineCatalogue, parseWineMemory } from "../src/wine-memory.js";

describe("parseWineMemory", () => {
  it("normalizes a structured tasting without losing Bart's prose", () => {
    const wine = parseWineMemory({
      path: "content/wine/2026-08-07-dumanet-cabernet-sauvignon.md",
      markdown: `---
title: Dumanet Cabernet Sauvignon
date: 2026-08-07
slug: dumanet-cabernet-sauvignon
producer: Dumanet
vintage: ""
country: France
region: Pays d’Oc, Southern France
grapes: [Cabernet Sauvignon]
rating: "89"
verdict: Pass
would_buy_again: "Yes"
buy_again: true
status: drunk
tags: [Cabernet Sauvignon, budget wine]
---
## First impression

Really delicious.

## What I noticed

Dark cherry and a hint of spice.

## Verdict

A definite Pass.

## Context

About €7 for the bottle.
`,
    });

    expect(wine).toMatchObject({
      id: "2026-08-07-dumanet-cabernet-sauvignon",
      title: "Dumanet Cabernet Sauvignon",
      date: "2026-08-07",
      producer: "Dumanet",
      vintage: null,
      country: "France",
      region: "Pays d’Oc, Southern France",
      grapes: ["Cabernet Sauvignon"],
      tags: ["Cabernet Sauvignon", "budget wine"],
      rating: 89,
      ratingLabel: "89",
      verdict: "Pass",
      wouldBuyAgain: true,
      status: "drunk",
      firstImpression: "Really delicious.",
      whatINoticed: "Dark cherry and a hint of spice.",
      verdictText: "A definite Pass.",
      context: "About €7 for the bottle.",
      url: "https://bartwagener.com/wine/2026/dumanet-cabernet-sauvignon/",
    });
  });

  it("keeps qualified ratings and leaves absent legacy fields unknown", () => {
    const wine = parseWineMemory({
      path: "content/wine/2026-07-21-gilbert-picq-chablis.md",
      markdown: `---
title: Gilbert Picq & ses Fils Chablis
date: 2026-07-21
slug: gilbert-picq-chablis
producer: Domaine Gilbert Picq & ses Fils
country: France
region: Chablis
grapes: [Chardonnay]
rating: "91*"
would_buy_again: "Yes"
buy_again: true
status: drunk
tags: [white, Chablis]
---
## First impression

Precise and mineral.

## What I tasted

Fresh citrus.

## Verdict

The asterisk reflects context.
`,
    });

    expect(wine).toMatchObject({
      rating: 91,
      ratingLabel: "91*",
      verdict: null,
      vintage: null,
      whatINoticed: "Fresh citrus.",
      context: null,
    });
  });

  it("parses benchmark prose and skips the section index", () => {
    expect(
      parseWineMemory({
        path: "content/wine/_index.md",
        markdown: "---\ntitle: Wine\n---\n",
      }),
    ).toBeNull();

    const wine = parseWineMemory({
      path: "content/wine/2026-07-10-lagassant-rouge.md",
      markdown: `---
title: L’Agassant Rouge 2022
date: 2026-07-10
slug: lagassant-rouge
producer: L’Agassant
vintage: "2022"
country: France
region: Bordeaux
grapes: [Merlot, Cabernet Sauvignon]
would_buy_again: "Yes"
buy_again: true
status: benchmark
tags: [benchmark, red, Bordeaux]
---
## Why it belongs here

Soft, generous and reliable.

## What it says about my taste

I like warmth without jamminess.
`,
    });

    expect(wine).toMatchObject({
      status: "benchmark",
      rating: null,
      ratingLabel: null,
      verdict: null,
      firstImpression: "Soft, generous and reliable.",
      whatINoticed: "I like warmth without jamminess.",
    });
  });

  it("uses buy_again when the display field is missing and ignores unsafe paths", () => {
    const wine = parseWineMemory({
      path: "content/wine/2026-01-01-example.md",
      markdown: `---
title: Example
date: 2026-01-01
slug: example
buy_again: false
status: drunk
---
`,
    });

    expect(wine?.wouldBuyAgain).toBe(false);
    expect(
      parseWineMemory({
        path: "content/blog/2026-01-01-example.md",
        markdown: "---\ntitle: Example\n---\n",
      }),
    ).toBeNull();
  });

  it("sorts a catalogue newest first with a stable id tie breaker", () => {
    const entry = (path: string, title: string, date: string, slug: string) => ({
      path,
      markdown: `---\ntitle: ${title}\ndate: ${date}\nslug: ${slug}\nstatus: drunk\n---\n`,
    });

    const wines = parseWineCatalogue([
      entry("content/wine/2026-01-01-b.md", "B", "2026-01-01", "b"),
      entry("content/wine/2026-02-01-c.md", "C", "2026-02-01", "c"),
      entry("content/wine/2026-01-01-a.md", "A", "2026-01-01", "a"),
    ]);

    expect(wines.map(({ id }) => id)).toEqual([
      "2026-02-01-c",
      "2026-01-01-a",
      "2026-01-01-b",
    ]);
  });

  it("normalizes every published wine entry in the live Hugo catalogue", async () => {
    const contentDirectory = new URL("../../../content/wine/", import.meta.url);
    const names = (await readdir(contentDirectory)).filter((name) => name.endsWith(".md"));
    const files = await Promise.all(
      names.map(async (name) => ({
        path: `content/wine/${name}`,
        markdown: await readFile(new URL(name, contentDirectory), "utf8"),
      })),
    );

    const wines = parseWineCatalogue(files);

    expect(wines).toHaveLength(names.length - 1);
    expect(
      wines.find(({ id }) => id === "2026-07-21-gilbert-picq-chablis"),
    ).toMatchObject({ rating: 91, ratingLabel: "91*", verdict: null });
    expect(
      wines.find(({ id }) => id === "2026-08-07-dumanet-cabernet-sauvignon"),
    ).toMatchObject({ rating: 89, verdict: "Pass", wouldBuyAgain: true });
  });
});
