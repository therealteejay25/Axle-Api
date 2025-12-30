import mongoose from "mongoose";
import { Execution } from "../models/Execution";
import { env } from "../config/env";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const inspect = async () => {
    const executionId = "694977b1a70dba4d884417ae";
    try {
        await mongoose.connect(env.MONGODB_URI);
        const execution = await Execution.findById(executionId);
        if (!execution) {
            console.error("Execution not found");
            process.exit(1);
        }
        
        let output = "=== AI PROMPT ===\n" + execution.aiPrompt + "\n\n=== AI RESPONSE ===\n" + execution.aiResponse + "\n";
        fs.writeFileSync("debug_ai.txt", output);
        console.log("Written to debug_ai.txt");
        
        process.exit(0);
    } catch (err: any) {
        console.error(err.message);
        process.exit(1);
    }
};

inspect();
