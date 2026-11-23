import { Server } from "socket.io";

// The one Socket.IO server, set once in index.ts.
// REST controllers import emitToUsers from here to push live updates.
let io: Server | null = null;

export function setIO(server: Server) {
  io = server;
}

// Send an event to specific users through their personal "user:<name>" channel
// (every socket joins it in user:join), so it reaches all their open tabs/devices.
export function emitToUsers(usernames: string[], event: string, data: unknown) {
  if (!io || usernames.length === 0) return; // no socket server 
  io.to(usernames.map((u) => `user:${u}`)).emit(event, data);
}
