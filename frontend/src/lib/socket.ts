import { io } from "socket.io-client";
import { BACKEND_URL } from "@/config/env";
import { getSession } from "@/lib/auth";

// One shared socket for the whole app. Created outside React so re-renders
// never open a second connection. We connect manually once the user is signed in.
export const socket = io(BACKEND_URL, {
  autoConnect: false,
  // Open a WebSocket straight away instead of starting with HTTP long-polling
  // and upgrading. Polling fills DevTools with repeated requests that look like
  // reconnects. Polling stays as a fallback if WebSockets are blocked.
  transports: ["websocket", "polling"],
  // Called on every (re)connect, so it always sends the current token.
  // The server checks it in io.use() and rejects the connection if it's invalid.
  auth: (cb) => cb({ token: getSession()?.token ?? "" }),
});

type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * If the socket is reconnecting (server restart, network blip, a long upload
 * on a weak connection), wait for it instead of emitting into the void.
 */
function waitForConnection(ms: number) {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      reject(new Error("Not connected to the server. Check your connection and try again."));
    }, ms);
    function onConnect() {
      clearTimeout(timer);
      resolve();
    }
    socket.once("connect", onConnect);
  });
}

// Emit an event and wait for the server's ack. Throws on error or timeout,
// so callers can use try/catch just like with fetch.
export async function emitAsync<T = unknown>(
  event: string,
  payload: unknown,
  timeoutMs = 10_000,
): Promise<T> {
  await waitForConnection(8_000);
  let res: AckResponse<T>;
  try {
    res = await socket.timeout(timeoutMs).emitWithAck(event, payload);
  } catch {
    // socket.io's own message is "operation has timed out", which isn't helpful
    throw new Error("The server didn't respond in time. Please try again.");
  }
  if (!res.ok) throw new Error(res.error);
  return res.data;
}
