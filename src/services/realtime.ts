import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initRealtime = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket: Socket) => {
    console.log("Client connected", socket.id);

    socket.on("subscribe_agent", (agentId: string) => {
      socket.join(`agent:${agentId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  return io;
};

export const getIo = () => io;

export const emitToAgent = (agentId: string, event: string, payload: any) => {
  if (!io) return;
  io.to(`agent:${agentId}`).emit(event, payload);
};

export default { initRealtime, getIo, emitToAgent };
