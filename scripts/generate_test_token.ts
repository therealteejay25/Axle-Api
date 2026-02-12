import jwt from "jsonwebtoken";
import { connectDB } from "../src/lib/db";
import { User } from "../src/models/User";
import { env } from "../src/config/env";
import dotenv from "dotenv";

dotenv.config();

const generateToken = async () => {
    await connectDB();

    // Find or create a test user
    let user = await User.findOne({ email: "test@example.com" });

    if (!user) {
        user = await User.create({
            email: "test@example.com",
            name: "Test User",
            plan: "free",
            credits: 100
        });
        console.log("Created new test user");
    } else {
        console.log("Found existing test user");
    }

    // Generate token
    const token = jwt.sign(
        {
            id: user._id,
            email: user.email,
            plan: user.plan
        },
        process.env.JWT_SECRET || "default_secret",
        { expiresIn: "1h" }
    );

    console.log("\n✅ Generated Test Token:");
    console.log(token);
    console.log("\n📋 Curl Command:");
    console.log(`curl -X POST http://localhost:7000/api/v1/billing/checkout \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${token}" \\
  -d '{"plan": "pro"}'`);

    process.exit(0);
};

generateToken().catch(console.error);
