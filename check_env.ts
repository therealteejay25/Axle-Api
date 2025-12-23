import { env } from "./src/config/env";
import dotenv from "dotenv";
dotenv.config();

console.log("X_CLIENT_ID:", process.env.X_CLIENT_ID ? "PRESENT" : "MISSING");
console.log("X_CLIENT_SECRET:", process.env.X_CLIENT_SECRET ? "PRESENT" : "MISSING");
console.log("X_REDIRECT_URI:", process.env.X_REDIRECT_URI);
console.log("API_VERSION:", process.env.API_VERSION || "v1");
console.log("PORT:", process.env.PORT);
