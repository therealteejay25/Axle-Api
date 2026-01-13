import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { load } from "cheerio";

const ArxivItemSchema = z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    url: z.string().url(),
    authors: z.array(z.string()).default([]),
    published: z.string().optional(),
});

const ArxivSearchResultSchema = z.object({
    success: z.boolean(),
    query: z.string(),
    expanded: z.boolean().default(false),
    expandedQuery: z.string().optional(),
    totalResults: z.number().default(0),
    results: z.array(ArxivItemSchema).default([]),
    researchLogs: z.array(z.string()).default([]),
});

const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "for",
    "on",
    "with",
    "using",
    "via",
    "based",
    "from",
    "at",
    "by",
]);

function expandQuery(original: string): string {
    const cleaned = original
        .replace(/\"/g, "")
        .replace(/[()\[\]{}]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tokens = cleaned
        .split(" ")
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !stopWords.has(t.toLowerCase()))
        .slice(0, 5);

    // Broaden by keeping core terms and encouraging survey-like results.
    const core = tokens.join(" ") || cleaned;
    return `${core} (survey OR review OR overview)`;
}

async function arxivQuery(query: string, maxResults: number) {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Axle/1.0 (research tool)",
        },
    });

    if (!res.ok) {
        throw new Error(`arXiv API error: ${res.status}`);
    }

    const xml = await res.text();
    const $ = load(xml, { xmlMode: true });

    const entries = $("entry");
    const results: Array<z.infer<typeof ArxivItemSchema>> = [];

    entries.each((_, el) => {
        const id = $(el).find("id").first().text().trim();
        const title = $(el).find("title").first().text().replace(/\s+/g, " ").trim();
        const summary = $(el).find("summary").first().text().replace(/\s+/g, " ").trim();
        const published = $(el).find("published").first().text().trim();

        const authors: string[] = [];
        $(el)
            .find("author > name")
            .each((_, a) => {
                const name = $(a).text().trim();
                if (name) authors.push(name);
            });

        const link =
            $(el)
                .find("link[rel='alternate']")
                .attr("href") ||
            id;

        if (!id || !link) return;

        results.push({
            id,
            title: title || "Untitled",
            summary: summary || "",
            url: link,
            authors,
            published,
        });
    });

    return results;
}

export const createArxivSearchTool = (userId: string) =>
    new FunctionTool({
        name: "arxiv_search",
        description:
            "Search arXiv for academic papers. If no results are found, the tool automatically expands the query and retries once.",
        parameters: z.object({
            query: z.string().min(1),
            maxResults: z.number().min(1).max(25).optional().default(8),
        }),
        execute: async (input: unknown) => {
            const { query, maxResults } = z
                .object({
                    query: z.string().min(1),
                    maxResults: z.number().min(1).max(25).optional().default(8),
                })
                .parse(input);

            const researchLogs: string[] = [];
            researchLogs.push(`[RESEARCH] Searching arXiv for: ${query}`);

            try {
                const first = await arxivQuery(query, maxResults);

                if (first.length > 0) {
                    const payload = ArxivSearchResultSchema.parse({
                        success: true,
                        query,
                        expanded: false,
                        totalResults: first.length,
                        results: first,
                        researchLogs: [
                            ...researchLogs,
                            `[RESEARCH] Synthesizing insights from ${Math.min(first.length, 3)} sources...`,
                        ],
                    });
                    return payload;
                }

                const expandedQuery = expandQuery(query);
                researchLogs.push(
                    `[RESEARCH] 0 results. Performing Query Expansion → ${expandedQuery}`
                );

                const second = await arxivQuery(expandedQuery, maxResults);

                const payload = ArxivSearchResultSchema.parse({
                    success: true,
                    query,
                    expanded: true,
                    expandedQuery,
                    totalResults: second.length,
                    results: second,
                    researchLogs: [
                        ...researchLogs,
                        second.length
                            ? `[RESEARCH] Found ${second.length} results after expansion.`
                            : `[RESEARCH] Still 0 results after expansion.`,
                        `[RESEARCH] Synthesizing insights from ${Math.min(second.length, 3)} sources...`,
                    ],
                });

                return payload;
            } catch (error: any) {
                return {
                    success: false,
                    query,
                    expanded: false,
                    totalResults: 0,
                    results: [],
                    researchLogs: [
                        ...researchLogs,
                        `[RESEARCH] arXiv search failed: ${error?.message || "unknown error"}`,
                    ],
                    error: error?.message || "arXiv search failed",
                };
            }
        },
    });
