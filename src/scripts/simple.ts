import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../lib/db";
import { redis } from "../lib/redis";

const test = async () => {
    try {
        console.log("Connecting DB...");
        await connectDB();
        console.log("DB Connected");
        console.log("Checking Redis...");
        await redis.ping();
        console.log("Redis PONG");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
