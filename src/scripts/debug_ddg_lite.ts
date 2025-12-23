import axios from "axios";
import fs from "fs";
import * as cheerio from "cheerio";

const run = async () => {
    const query = "TypeScript JavaScript HTML CSS developer jobs Remote site:linkedin.com/jobs";
    // DDG Lite uses POST or GET. GET works: https://lite.duckduckgo.com/lite/?q=...
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;
    
    console.log(`Fetching ${searchUrl}...`);
    
    try {
        const response = await axios.get(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml"
            }
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Length: ${response.data.length}`);
        
        fs.writeFileSync("debug_ddg_lite.html", response.data);
        
        const $ = cheerio.load(response.data);
        // Lite selectors: .result-link, table?
        // Usually it's a table.
        const links = $(".result-link").length;
        const tds = $("td").length;
        
        console.log(`Parsed .result-link: ${links}`);
        console.log(`Parsed td: ${tds}`);
        
        if (links > 0) {
             const firstTitle = $(".result-link").first().text();
             console.log("First Title:", firstTitle);
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    }
};

run();
