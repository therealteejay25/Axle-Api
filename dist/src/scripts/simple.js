"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = require("../lib/db");
const redis_1 = require("../lib/redis");
const test = async () => {
    try {
        console.log("Connecting DB...");
        await (0, db_1.connectDB)();
        console.log("DB Connected");
        console.log("Checking Redis...");
        await redis_1.redis.ping();
        console.log("Redis PONG");
        process.exit(0);
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
};
test();
