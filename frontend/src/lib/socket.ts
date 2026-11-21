import { io } from "socket.io-client";
import { BACKEND_URL } from "@/config/env";
import { getSession } from "@/lib/auth";

// One shared socket for the whole app. Created outside React so re-renders
// never open a second connection. We connect manually once the user is signed in.
export const socket = io(BACKEND_URL, {
  autoConnect: false,
  // Called on every (re)connect, so it always sends the current token.
  // The server checks it in io.use() and rejects the connection if it's invalid.
  auth: (cb) => cb({ token: getSession()?.token ?? "" }),
});

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// Emit an event and wait for the server's ack. Throws on error or timeout,
// so callers can use try/catch just like with fetch.
export async function emitAsync<T = unknown>(event: string, payload: unknown): Promise<T> {
  const res: AckResponse<T> = await socket.timeout(5000).emitWithAck(event, payload);
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
