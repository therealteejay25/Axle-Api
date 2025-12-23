import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "./logger";

export class SocketService {
  private static instance: SocketService;
  private io: Server | null = null;

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

      socket.on("disconnect", () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

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
}
