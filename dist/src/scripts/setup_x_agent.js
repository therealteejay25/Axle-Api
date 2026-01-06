"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Agent_1 = require("../models/Agent");
const User_1 = require("../models/User");
const Integration_1 = require("../models/Integration");
const crypto_1 = require("../services/crypto");
const env_1 = require("../config/env");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const setup = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        // 1. Get User
        const user = await User_1.User.findOne({});
        if (!user) {
            console.error("No user found.");
            process.exit(1);
        }
        console.log(`User: ${user.email} (${user._id})`);
        // 2. Check for Twitter Token in Env
        const twitterToken = process.env.TWITTER_ACCESS_TOKEN;
        // 3. Upsert Integration
        let integration = await Integration_1.Integration.findOne({ userId: user._id, provider: "twitter" });
        if (twitterToken) {
            console.log("Found TWITTER_ACCESS_TOKEN in env, configuring Integration...");
            if (!integration) {
                integration = new Integration_1.Integration({
                    userId: user._id,
                    provider: "twitter",
                    status: "connected",
                    accessToken: (0, crypto_1.encryptToken)(twitterToken),
                    scopes: ["tweet.read", "tweet.write", "users.read"],
                    metadata: { username: "unknown" } // Could fetch profile if we wanted, but optional
                });
            }
            else {
                integration.accessToken = (0, crypto_1.encryptToken)(twitterToken);
                integration.status = "connected";
            }
            await integration.save();
            console.log("✅ Twitter Integration configured.");
        }
        else {
            if (integration && integration.status === "connected") {
                console.log("Use existing Twitter integration.");
            }
            else {
                console.log("⚠️ No TWITTER_ACCESS_TOKEN found in .env and no existing integration.");
                console.log("Please add TWITTER_ACCESS_TOKEN=... to your .env file and re-run this script.");
                process.exit(1);
            }
        }
        // 4. Create "X Poster" Agent
        const agentConfig = {
            name: "X Poster",
            description: "An agent that can post tweets to your X account.",
            ownerId: user._id,
            brain: {
                model: "gemini-1.5-pro-002",
                systemPrompt: `You are a social media manager for the user's personal brand.
Your goal is to create engaging, concise, and professional posts for X (Twitter).

CAPABILITIES:
- You can post tweets using the 'twitter_post_tweet' action (params: text (string), replyToId (string, optional)).
- You can create threads by chaining multiple 'twitter_post_tweet' actions.

INSTRUCTIONS:
- Each tweet must be within 280 characters.
- To create a thread:
  1. Add multiple 'twitter_post_tweet' objects to the 'actions' array in order.
  2. For the second tweet onwards, use the 'replyToId' parameter.
  3. Reference the ID of the previous tweet using Nunjucks syntax: {{ twitter_post_tweet.data.id }}.
- The execution engine resolves these templates sequentially, so 'twitter_post_tweet' always refers to the result of the *last* completed tweet action.

Example of a 2-tweet thread:
{
  "actions": [
    {
      "type": "twitter_post_tweet",
      "params": { "text": "This is tweet 1 of my thread!" }
    },
    {
      "type": "twitter_post_tweet",
      "params": { 
        "text": "This is tweet 2, replying to the first one!",
        "replyToId": "{{ twitter_post_tweet.data.id }}"
      }
    }
  ]
}
`,
                temperature: 0.7
            },
            integrations: ["twitter"],
            actions: ["twitter_post_tweet", "twitter_search", "twitter_get_me"]
        };
        let agent = await Agent_1.Agent.findOne({ name: agentConfig.name, ownerId: user._id });
        if (agent) {
            console.log("Updating X Poster agent...");
            Object.assign(agent, agentConfig);
            await agent.save();
        }
        else {
            console.log("Creating X Poster agent...");
            agent = await Agent_1.Agent.create(agentConfig);
        }
        console.log("✅ Agent 'X Poster' is ready!");
        console.log(`Agent ID: ${agent._id}`);
        console.log("Try it: curl -X POST http://localhost:7000/api/v1/agents/run -H 'Content-Type: application/json' -d '{\"agentId\": \"" + agent._id + "\", \"task\": \"Post a tweet saying Axle API is live!\"}'");
        process.exit(0);
    }
    catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
};
setup();
