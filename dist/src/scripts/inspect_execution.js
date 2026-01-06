"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Execution_1 = require("../models/Execution");
const env_1 = require("../config/env");
const fs_1 = __importDefault(require("fs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const inspect = async () => {
    const executionId = "694977b1a70dba4d884417ae";
    try {
        await mongoose_1.default.connect(env_1.env.MONGODB_URI);
        const execution = await Execution_1.Execution.findById(executionId);
        if (!execution) {
            console.error("Execution not found");
            process.exit(1);
        }
        let output = "=== AI PROMPT ===\n" + execution.aiPrompt + "\n\n=== AI RESPONSE ===\n" + execution.aiResponse + "\n";
        fs_1.default.writeFileSync("debug_ai.txt", output);
        console.log("Written to debug_ai.txt");
        process.exit(0);
    }
    catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};
inspect();
