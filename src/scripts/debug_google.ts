import axios from "axios";
import fs from "fs";
import * as cheerio from "cheerio";

const run = async () => {
    const query = "TypeScript JavaScript HTML CSS developer jobs Remote site:linkedin.com/jobs";
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.google.com/search?q=${encodedQuery}&num=10`;
    
    console.log(`Fetching ${searchUrl}...`);
    
    try {
        const response = await axios.get(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Length: ${response.data.length}`);
        
        fs.writeFileSync("debug_google.html", response.data);
        console.log("Saved to debug_google.html");
        
        const $ = cheerio.load(response.data);
        const results = $("div.g").length;
        const resultsFallback = $("div[data-hveid]").length;
        const h3 = $("h3").length;
        
        console.log(`Parsed div.g: ${results}`);
        console.log(`Parsed div[data-hveid]: ${resultsFallback}`);
        console.log(`Parsed h3: ${h3}`);
        
        if (results === 0) {
            console.log("Title:", $("title").text());
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    }
};

run();
