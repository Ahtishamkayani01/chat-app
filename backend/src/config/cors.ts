import type { CorsOptions } from "cors";

// Which websites (frontend origins) may call this API and open a socket.
// Set CORS_ORIGINS on the server as a comma-separated list, e.g.
//   CORS_ORIGINS=https://my-chat.vercel.app,http://localhost:3000
const DEFAULT_ORIGINS = [
  "http://localhost:3000", // Next.js dev server
  "https://chat-app-production-226e1fa5.up.railway.app", // this backend itself
];

export const allowedOrigins = (process.env.CORS_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, "")) // "https://x.app/" → "https://x.app"
  .filter(Boolean);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No origin = curl, Postman, server-to-server: allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} is not allowed`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
