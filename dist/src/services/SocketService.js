"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketService = void 0;
const socket_io_1 = require("socket.io");
const logger_1 = require("./logger");
class SocketService {
    static instance;
    io = null;
    constructor() { }
    static getInstance() {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }
    init(server) {
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.io.on("connection", (socket) => {
            logger_1.logger.info(`Socket connected: ${socket.id}`);
            socket.on("subscribe", (agentId) => {
                socket.join(`agent:${agentId}`);
                logger_1.logger.info(`Socket ${socket.id} subscribed to agent:${agentId}`);
            });
            socket.on("disconnect", () => {
                logger_1.logger.info(`Socket disconnected: ${socket.id}`);
            });
        });
        logger_1.logger.info("Socket.io initialized");
    }
    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
    emitToAgent(agentId, event, data) {
        if (this.io) {
            this.io.to(`agent:${agentId}`).emit(event, data);
        }
    }
}
exports.SocketService = SocketService;
