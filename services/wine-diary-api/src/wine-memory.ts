import { parse as parseYaml } from "yaml";

export interface PublishedWineFile {
  path: string;
  markdown: string;
}

export interface WineMemory {
  id: string;
  title: string;
  date: string;
  producer: string | null;
  vintage: string | null;
  country: string | null;
  region: string | null;
  grapes: string[];
  tags: string[];
  rating: number | null;
  ratingLabel: string | null;
  verdict: "Class" | "Pass" | "Arse" | null;
  wouldBuyAgain: boolean | null;
  status: "drunk" | "benchmark";
  firstImpression: string | null;
  whatINoticed: string | null;
  verdictText: string | null;
  context: string | null;
  url: string;
}

interface ParsedMarkdown {
  frontMatter: Record<string, unknown>;
  sections: Map<string, string>;
}

const WINE_PATH = /^content\/wine\/([^/]+)\.md$/;
const FRONT_MATTER = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;
const HEADING = /^##\s+(.+?)\s*$/gm;

function scalar(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(scalar)
    .filter((item): item is string => item !== null);
}

function requiredScalar(
  frontMatter: Record<string, unknown>,
  name: string,
  path: string,
): string {
  const value = scalar(frontMatter[name]);
  if (value === null) throw new Error(`Wine entry ${path} is missing ${name}`);
  return value;
}

function parseRating(value: unknown): {
  rating: number | null;
  ratingLabel: string | null;
} {
  const ratingLabel = scalar(value);
  if (ratingLabel === null) return { rating: null, ratingLabel: null };
  const match = /^(\d{1,3})/.exec(ratingLabel);
  if (!match) return { rating: null, ratingLabel };
  const rating = Number(match[1]);
  return {
    rating: Number.isInteger(rating) && rating >= 0 && rating <= 100 ? rating : null,
    ratingLabel,
  };
}

function parseVerdict(value: unknown): WineMemory["verdict"] {
  return value === "Class" || value === "Pass" || value === "Arse" ? value : null;
}

function parseBuyAgain(frontMatter: Record<string, unknown>): boolean | null {
  if (typeof frontMatter.buy_again === "boolean") return frontMatter.buy_again;
  const display = scalar(frontMatter.would_buy_again)?.toLowerCase();
  if (display === "yes") return true;
  if (display === "no") return false;
  return null;
}

function parseSections(body: string): Map<string, string> {
  const headings = [...body.matchAll(HEADING)];
  const sections = new Map<string, string>();

  headings.forEach((heading, index) => {
    const name = heading[1]?.trim().toLowerCase();
    if (!name || heading.index === undefined) return;
    const contentStart = heading.index + heading[0].length;
    const contentEnd = headings[index + 1]?.index ?? body.length;
    const content = body.slice(contentStart, contentEnd).trim();
    if (content.length > 0) sections.set(name, content);
  });

  return sections;
}

function parseMarkdown(markdown: string): ParsedMarkdown {
  const match = FRONT_MATTER.exec(markdown);
  if (!match) throw new Error("Wine entry is missing YAML front matter");
  const parsed = parseYaml(match[1] ?? "");
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Wine entry front matter must be an object");
  }
  return {
    frontMatter: parsed as Record<string, unknown>,
    sections: parseSections(markdown.slice(match[0].length)),
  };
}

function section(sections: Map<string, string>, ...names: string[]): string | null {
  for (const name of names) {
    const value = sections.get(name.toLowerCase());
    if (value) return value;
  }
  return null;
}

export function parseWineMemory(
  input: PublishedWineFile,
  siteOrigin = "https://bartwagener.com",
): WineMemory | null {
  const pathMatch = WINE_PATH.exec(input.path);
  if (!pathMatch || pathMatch[1] === "_index") return null;

  const { frontMatter, sections } = parseMarkdown(input.markdown);
  const date = requiredScalar(frontMatter, "date", input.path);
  const slug = requiredScalar(frontMatter, "slug", input.path);
  const { rating, ratingLabel } = parseRating(frontMatter.rating);
  const origin = siteOrigin.replace(/\/+$/, "");
  const status = frontMatter.status === "benchmark" ? "benchmark" : "drunk";

  return {
    id: pathMatch[1] ?? slug,
    title: requiredScalar(frontMatter, "title", input.path),
    date,
    producer: scalar(frontMatter.producer),
    vintage: scalar(frontMatter.vintage),
    country: scalar(frontMatter.country),
    region: scalar(frontMatter.region),
    grapes: stringList(frontMatter.grapes),
    tags: stringList(frontMatter.tags),
    rating,
    ratingLabel,
    verdict: parseVerdict(frontMatter.verdict),
    wouldBuyAgain: parseBuyAgain(frontMatter),
    status,
    firstImpression:
      status === "benchmark"
        ? section(sections, "Why it belongs here")
        : section(sections, "First impression"),
    whatINoticed:
      status === "benchmark"
        ? section(sections, "What it says about my taste")
        : section(sections, "What I noticed", "What I tasted"),
    verdictText: section(sections, "Verdict"),
    context: section(sections, "Context"),
    url: `${origin}/wine/${date.slice(0, 4)}/${slug}/`,
  };
}

export function parseWineCatalogue(
  files: PublishedWineFile[],
  siteOrigin = "https://bartwagener.com",
): WineMemory[] {
  return files
    .map((file) => parseWineMemory(file, siteOrigin))
    .filter((wine): wine is WineMemory => wine !== null)
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}
