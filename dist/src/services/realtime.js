"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToAgent = exports.getIo = exports.initRealtime = void 0;
const socket_io_1 = require("socket.io");
let io = null;
const initRealtime = (httpServer) => {
    io = new socket_io_1.Server(httpServer, {
        cors: { origin: "*" },
    });
    io.on("connection", (socket) => {
        console.log("Client connected", socket.id);
        socket.on("subscribe_agent", (agentId) => {
            socket.join(`agent:${agentId}`);
        });
        socket.on("disconnect", () => {
            console.log("Client disconnected", socket.id);
        });
    });
    return io;
};
exports.initRealtime = initRealtime;
const getIo = () => io;
exports.getIo = getIo;
const emitToAgent = (agentId, event, payload) => {
    if (!io)
        return;
    io.to(`agent:${agentId}`).emit(event, payload);
};
exports.emitToAgent = emitToAgent;
exports.default = { initRealtime: exports.initRealtime, getIo: exports.getIo, emitToAgent: exports.emitToAgent };
