import { createLogger, format, transports } from "winston";

export const logger = createLogger({
  level: "info",
  format: format.combine(
    format.errors({ stack: true }),
    format.json(),
    format.timestamp(),
    format.colorize(),
    format.printf(
      (info: {timestamp: any, level: any, message: any}) =>
        `${info.timestamp} ${info.level} ${info.message}`
    )
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
});
