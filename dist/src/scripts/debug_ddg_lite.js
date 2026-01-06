"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const cheerio = __importStar(require("cheerio"));
const run = async () => {
    const query = "TypeScript JavaScript HTML CSS developer jobs Remote site:linkedin.com/jobs";
    // DDG Lite uses POST or GET. GET works: https://lite.duckduckgo.com/lite/?q=...
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;
    console.log(`Fetching ${searchUrl}...`);
    try {
        const response = await axios_1.default.get(searchUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml"
            }
        });
        console.log(`Status: ${response.status}`);
        console.log(`Length: ${response.data.length}`);
        fs_1.default.writeFileSync("debug_ddg_lite.html", response.data);
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
    }
    catch (err) {
        console.error("Error:", err.message);
    }
};
run();
