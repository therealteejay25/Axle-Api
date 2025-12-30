import { searchDuckDuckGo, searchGoogle } from "../adapters/scraper";

const run = async () => {
    const query = "TypeScript developer jobs Remote";
    console.log("Testing Puppeteer Scraper with query:", query);

    console.log("\n--- Testing DuckDuckGo ---");
    try {
        const ddg = await searchDuckDuckGo({ query, numResults: 3 }, { provider: "test" });
        console.log("DDG Count:", ddg.resultsCount);
        ddg.results.forEach((r, i) => console.log(`[${i+1}] ${r.title} - ${r.url}`));
    } catch (e: any) {
        console.error("DDG Error:", e.message);
    }

    console.log("\n--- Testing Google ---");
    try {
        const google = await searchGoogle({ query, numResults: 3 }, { provider: "test" });
        console.log("Google Count:", google.resultsCount);
        google.results.forEach((r, i) => console.log(`[${i+1}] ${r.title} - ${r.url}`));
    } catch (e: any) {
        console.error("Google Error:", e.message);
    }
};

run();
