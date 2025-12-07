import dotenv from "dotenv";
dotenv.config();

// Some libraries expect the env var name `OPENAI_API_KEY`.
// Provide a fallback from our existing `OPENAI_KEY` to avoid missing-credentials errors.
if (process.env.OPENAI_KEY && !process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_KEY;
}

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// Validate required env vars
const requiredVars = [
  "PORT",
  "MONGODB_URI",
  "API_VERSION",
  "JWT_SECRET",
  "REFRESH_SECRET",
  "OPENAI_KEY",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_REDIRECT_URI",
  "INTEGRATION_ENC_KEY",
];

if (IS_PROD) {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(
        ", "
      )}`
    );
  }
}

export const env = {
  NODE_ENV,
  IS_PROD,
  PORT: process.env.PORT!,
  MONGODB_URI: process.env.MONGODB_URI!,
  API_VERSION: process.env.API_VERSION || "v1",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
  RESEND_API_KEY: process.env.RESEND_API_KEY!,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  REFRESH_SECRET: process.env.REFRESH_SECRET!,
  OPENAI_KEY: process.env.OPENAI_KEY!,
  OPENAI_API_BASE: process.env.OPENAI_API_BASE || "https://api.algion.dev/v1",
  MODEL: process.env.MODEL!,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID!,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET!,
  GITHUB_REDIRECT_URI: process.env.GITHUB_REDIRECT_URI!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI,
  INSTAGRAM_CLIENT_ID: process.env.INSTAGRAM_CLIENT_ID,
  INSTAGRAM_CLIENT_SECRET: process.env.INSTAGRAM_CLIENT_SECRET,
  INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI,
  X_CLIENT_ID: process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  X_REDIRECT_URI: process.env.X_REDIRECT_URI,
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  INTEGRATION_ENC_KEY: process.env.INTEGRATION_ENC_KEY!,
  // SMTP configuration for send_email tool
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || "587",
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 min
  RATE_LIMIT_MAX_REQUESTS: parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || "100"
  ),
  // Agent execution
  AGENT_TIMEOUT_MS: parseInt(process.env.AGENT_TIMEOUT_MS || "30000"), // 30 sec
  AGENT_MAX_RETRIES: parseInt(process.env.AGENT_MAX_RETRIES || "3"),
};
