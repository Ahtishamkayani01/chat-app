import { io } from "socket.io-client";
import { BACKEND_URL } from "@/config/env";

// One shared socket for the whole app. Created outside React so re-renders
// never open a second connection. We connect manually after the user joins.
export const socket = io(BACKEND_URL, {
  autoConnect: false,
});

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// Emit an event and wait for the server's ack. Throws on error or timeout,
// so callers can use try/catch just like with fetch.
export async function emitAsync<T = unknown>(event: string, payload: unknown): Promise<T> {
  const res: AckResponse<T> = await socket.timeout(5000).emitWithAck(event, payload);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
