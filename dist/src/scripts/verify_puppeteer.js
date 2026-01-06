"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_1 = require("../adapters/scraper");
const run = async () => {
    const query = "TypeScript developer jobs Remote";
    console.log("Testing Puppeteer Scraper with query:", query);
    console.log("\n--- Testing DuckDuckGo ---");
    try {
        const ddg = await (0, scraper_1.searchDuckDuckGo)({ query, numResults: 3 }, { provider: "test" });
        console.log("DDG Count:", ddg.resultsCount);
        ddg.results.forEach((r, i) => console.log(`[${i + 1}] ${r.title} - ${r.url}`));
    }
    catch (e) {
        console.error("DDG Error:", e.message);
    }
    console.log("\n--- Testing Google ---");
    try {
        const google = await (0, scraper_1.searchGoogle)({ query, numResults: 3 }, { provider: "test" });
        console.log("Google Count:", google.resultsCount);
        google.results.forEach((r, i) => console.log(`[${i + 1}] ${r.title} - ${r.url}`));
    }
    catch (e) {
        console.error("Google Error:", e.message);
    }
};
run();
