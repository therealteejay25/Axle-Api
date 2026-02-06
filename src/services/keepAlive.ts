import axios from "axios";
import { logger } from "./logger";
import { env } from "../config/env";

// ============================================
// KEEP ALIVE SERVICE
// ============================================
// Use this to prevent free tier servers (Render, Railway, etc.)
// from sleeping due to inactivity.
// ============================================

class KeepAliveService {
    private intervalId: NodeJS.Timeout | null = null;
    private readonly INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (render sleeps after 15)

    start() {
        if (this.intervalId) return;

        // determine self URL
        const selfUrl = env.NODE_ENV === "production"
            ? "https://axle-api-q8oa.onrender.com/health/live" // HARDCODED for now based on context, ideally from env
            : `http://localhost:${env.PORT}/health/live`;

        logger.info(`[KeepAlive] Starting keep-alive pings to ${selfUrl}`);

        this.ping(selfUrl); // Initial ping

        this.intervalId = setInterval(() => {
            this.ping(selfUrl);
        }, this.INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info("[KeepAlive] Stopped");
        }
    }

    private async ping(url: string) {
        try {
            await axios.get(url);
            logger.debug("[KeepAlive] Ping successful");
        } catch (error: any) {
            logger.warn(`[KeepAlive] Ping failed: ${error.message}`);
        }
    }
}

export const keepAliveService = new KeepAliveService();
