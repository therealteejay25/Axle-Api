import winston from "winston";
import { env } from "../config/env";

// ============================================
// LOGGER SERVICE
// ============================================
// Structured logging for all execution logs.
// ============================================

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length 
    ? ` ${JSON.stringify(meta)}` 
    : "";
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

// JSON format for production
const prodFormat = printf(({ level, message, timestamp, ...meta }) => {
  return JSON.stringify({
    timestamp,
    level,
    message,
    ...meta
  });
});

export const logger = winston.createLogger({
  level: env.IS_PROD ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        env.IS_PROD ? prodFormat : devFormat
      )
    })
  ]
});

// Add file transport in production
if (env.IS_PROD) {
  logger.add(new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
    format: prodFormat
  }));
  
  logger.add(new winston.transports.File({
    filename: "logs/combined.log",
    format: prodFormat
  }));
}

// Execution-specific logging helper
export const logExecution = (
  executionId: string,
  event: string,
  data?: Record<string, any>
) => {
  logger.info(`[Execution:${executionId}] ${event}`, {
    executionId,
    ...data
  });
};

export default logger;
