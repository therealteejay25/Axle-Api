import express from "express";
import cors from "cors";
import dotenv from "dotenv"
import cookieParser from "cookie-parser";
import authRouter from "./src/routes/auth";
import githubRouter from "./src/routes/github";
import { agentRouter } from "./src/routes/axle";
import connectDB from "./src/config/db";


dotenv.config()


export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// routes
app.use("/api/auth", authRouter);
app.use("/api/github", githubRouter);
app.use("/api/agents", agentRouter);

connectDB();

app.listen(process.env.PORT!, () => {
  console.log(`🚀 Axle backend running on port ${process.env.PORT!}`);
});