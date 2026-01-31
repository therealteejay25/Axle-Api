import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./logger";
import { approvalService } from "./approvalService";

export class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;
  private approvalListenersAttached = false;

  private constructor() {}

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  init(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.io.on("connection", (socket) => {
      logger.info(`Socket connected: ${socket.id}`);
      
      socket.on("subscribe", (agentId: string) => {
        socket.join(`agent:${agentId}`);
        logger.info(`Socket ${socket.id} subscribed to agent:${agentId}`);
      });

      socket.on("subscribe_execution", (executionId: string) => {
        socket.join(`execution:${executionId}`);
        logger.info(
          `Socket ${socket.id} subscribed to execution:${executionId}`
        );
      });

      // Handle tool actions from UI cards (send email, post tweet, etc.)
      socket.on("tool_action", async (data) => {
        const { executionId, action, data: actionData } = data;
        logger.info(`[SOCKET] Tool action received: ${action}`, { executionId, action });
        
        try {
          // Import tool executor dynamically to avoid circular deps
          const { executeToolAction } = await import("./toolActionExecutor");
          await executeToolAction(executionId, action, actionData);
        } catch (error) {
          logger.error(`[SOCKET] Tool action failed: ${action}`, { error });
          socket.emit("tool_action_error", {
            executionId,
            action,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });

      // Handle approval/rejection responses from UI
      socket.on("approval_response", async (data) => {
        const { approvalId, approved, reason } = data;
        logger.info(`[SOCKET] Approval response: ${approvalId}`, { approved, reason });
        
        try {
          if (approved) {
            await approvalService.approve(approvalId);
          } else {
            await approvalService.reject(approvalId, reason);
          }
        } catch (error) {
          logger.error(`[SOCKET] Approval response failed`, { error });
        }
      });

      socket.on("disconnect", () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

    // Forward approval events to clients subscribed to the execution room.
    // Guarded to avoid duplicate listeners when init() is called more than once.
    if (!this.approvalListenersAttached) {
      this.approvalListenersAttached = true;

      approvalService.on("approval_required", ({ approval }) => {
        if (!this.io) return;
        this.io
          .to(`execution:${approval.executionId}`)
          .emit("approval_required", { approval });
      });

      approvalService.on("approval_resolved", ({ approval }) => {
        if (!this.io) return;
        this.io
          .to(`execution:${approval.executionId}`)
          .emit("approval_resolved", { approval });
      });
    }

    logger.info("Socket.io initialized");
  }

  emit(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  emitToAgent(agentId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`agent:${agentId}`).emit(event, data);
    }
  }

  emitToExecution(executionId: string, event: string, data: any) {
    if (this.io) {
      this.io.to(`execution:${executionId}`).emit(event, data);
    }
  }
}
