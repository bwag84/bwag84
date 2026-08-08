import { describe, expect, it } from "vitest";

import {
  captureIdSuffix,
  contentPath,
  imagePath,
  slugifyWineTitle,
  withNumericSuffix,
} from "../src/slug.js";

describe("slug helpers", () => {
  it("transliterates common accented Latin characters", () => {
    expect(slugifyWineTitle("Viña Oropéndola Verdejo 2022")).toBe(
      "vina-oropendola-verdejo-2022",
    );
  });

  it("removes apostrophes and normalizes separators", () => {
    expect(slugifyWineTitle("L’Agassant / Rouge")).toBe("lagassant-rouge");
    expect(slugifyWineTitle("  Wine --- Name  ")).toBe("wine-name");
  });

  it("limits slugs without leaving a trailing separator", () => {
    const slug = slugifyWineTitle(`Wine ${"long ".repeat(30)}`);

    expect(slug.length).toBeLessThanOrEqual(72);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("rejects a title without alphanumeric content", () => {
    expect(() => slugifyWineTitle("/// — !!!")).toThrow(/slug/i);
  });

  it("adds numeric suffixes only for collisions", () => {
    expect(withNumericSuffix("example-wine", 1)).toBe("example-wine");
    expect(withNumericSuffix("example-wine", 2)).toBe("example-wine-2");
    expect(withNumericSuffix("example-wine", 12)).toBe("example-wine-12");
    expect(() => withNumericSuffix("example-wine", 0)).toThrow();
  });

  it("hashes capture IDs instead of exposing them in branch names", () => {
    expect(captureIdSuffix("capture-20260808-abc123")).toBe("54591a1cb49b");
  });

  it("constructs only the controlled wine paths", () => {
    expect(contentPath("2026-08-08", "example-wine")).toBe(
      "content/wine/2026-08-08-example-wine.md",
    );
    expect(imagePath("2026-08-08", "example-wine")).toBe(
      "static/images/wine/2026-08-08-example-wine.webp",
    );
  });
});
