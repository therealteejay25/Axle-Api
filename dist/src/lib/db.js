"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("../config/env");
// ============================================
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        console.log("MongoDB connected");
    }
    catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
mongoose_1.default.connection.on("error", (err) => {
    console.error("MongoDB error:", err);
});
mongoose_1.default.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
});
exports.default = { connectDB: exports.connectDB };
