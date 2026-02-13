import { createCoupon, getCoupon } from "../src/services/coupon";
import { logger } from "../src/services/logger";

// Mock environment variables
process.env.POLAR_ACCESS_TOKEN = "mock_token";
process.env.POLAR_ORGANIZATION_ID = "mock_org_id";
process.env.POLAR_API_URL = "https://api.polar.sh/v1";

// Mock fetch
const originalFetch = global.fetch;

// @ts-ignore
global.fetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
    const urlStr = url.toString();
    console.log(`[MockFetch] ${options.method || 'GET'} ${urlStr}`);

    if (urlStr.includes("/discounts") && options.method === "POST") {
        const body = JSON.parse(options.body as string);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                id: "discount_123",
                code: body.code,
                type: body.type,
                amount: body.amount,
                duration: body.duration,
                organization_id: body.organization_id
            }),
            text: async () => ""
        } as Response;
    }

    if (urlStr.includes("/discounts") && options.method === "GET") {
        // Mock getCoupon list response
        return {
            ok: true,
            status: 200,
            json: async () => ({
                items: [
                    {
                        id: "discount_123",
                        code: "TESTCODE",
                        type: "percentage",
                        amount: 20,
                        duration: "once"
                    }
                ]
            }),
            text: async () => ""
        } as Response;
    }

    return {
        ok: false,
        status: 404,
        text: async () => "Not Found"
    } as Response;
};

async function runTests() {
    console.log("Starting Coupon Service Tests...");

    try {
        console.log("\nTest 1: Create Coupon");
        const coupon = await createCoupon({
            code: "TEST20",
            type: "percentage",
            amount: 20,
            duration: "once"
        });
        console.log("Created Coupon:", coupon);
        if (coupon.code === "TEST20" && coupon.amount === 20) {
            console.log("✅ Create Coupon Passed");
        } else {
            console.error("❌ Create Coupon Failed");
        }

        console.log("\nTest 2: Get Coupon");
        const fetchedCoupon = await getCoupon("TESTCODE");
        console.log("Fetched Coupon:", fetchedCoupon);
        if (fetchedCoupon && fetchedCoupon.code === "TESTCODE") {
            console.log("✅ Get Coupon Passed");
        } else {
            console.error("❌ Get Coupon Failed");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

// Run
runTests().catch(console.error);
