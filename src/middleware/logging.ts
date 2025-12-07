import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

/**
 * Request logging middleware: adds correlation ID and logs request/response.
 */
export const requestLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = req.headers["x-correlation-id"] || uuidv4();
  (req as any).correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    const level = status >= 400 ? "warn" : "info";

    logger[level as "info" | "warn"](
      `[${correlationId}] ${req.method} ${req.path} - ${status} (${duration}ms)`
    );
  });

  next();
};

export default { requestLoggingMiddleware };
