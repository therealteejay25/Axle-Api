
import dotenv from 'dotenv';
import axios from 'axios';
import { Webhook } from 'standardwebhooks';

dotenv.config();

const WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;
const API_URL = 'http://localhost:7000/api/v1/webhooks/polar';

if (!WEBHOOK_SECRET) {
    console.error('Error: POLAR_WEBHOOK_SECRET is not set in .env');
    process.exit(1);
}

const payload = {
    type: 'subscription.created',
    data: {
        id: 'sub_1234567890',
        status: 'active',
        currrent_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
        started_at: new Date().toISOString(),
        ended_at: null,
        customer_id: 'pol_cust_12345',
        product_id: 'prod_123',
        price_id: process.env.POLAR_PRICE_ID_PRO || 'price_12345',
        checkout_id: 'checkout_123',
        customer: {
            id: 'pol_cust_12345',
            email: 'test@example.com',
            public_name: 'Test User',
            avatar_url: null,
            deleted_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            organization_id: process.env.POLAR_ORGANIZATION_ID || "org_fake",
            email_verified: true,
            billing_address: null,
            tax_id: null,
            oauth_accounts: []
        },
        organization_id: process.env.POLAR_ORGANIZATION_ID || "org_fake",

        product: {
            id: 'prod_123',
            name: 'Pro Plan',
            description: 'Pro plan description',
            organization_id: process.env.POLAR_ORGANIZATION_ID || "org_fake",
            prices: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_recurring: true,
            is_archived: false,
            medias: [],
            attached_custom_fields: [],

            // Missing fields added:
            trial_interval: "day", // valid enum
            trial_interval_count: 0,
            visibility: "public",
            recurring_interval: "month",
            recurring_interval_count: 1,
            metadata: {},
            benefits: []
        },

        discount: null,
        prices: [],
        meters: [],

        metadata: {
            plan: "pro"
        },

        amount: 1000,
        currency: 'usd',
        recurring_interval: 'month'
    }
};

const payloadString = JSON.stringify(payload);

const base64Secret = Buffer.from(WEBHOOK_SECRET, "utf-8").toString("base64");
const wh = new Webhook(base64Secret);

const timestamp = new Date();
const msgId = "msg_" + Date.now();

async function sendWebhook() {
    try {
        const signature = await wh.sign(msgId, timestamp, payloadString);

        console.log('Sending webhook to:', API_URL);
        console.log('Signature:', signature);

        const response = await axios.post(API_URL, payloadString, {
            headers: {
                'Content-Type': 'application/json',
                'webhook-id': msgId,
                'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
                'webhook-signature': signature,
                'polar-webhook-signature': signature
            },
            transformRequest: [(data) => data]
        });
        console.log('Success:', response.status, response.data);
    } catch (error: any) {
        if (error.response) {
            console.error('Error response:', error.response.status, error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

sendWebhook();
