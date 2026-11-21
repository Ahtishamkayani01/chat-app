import type { CorsOptions } from "cors";

// Which websites (frontend origins) may call this API and open a socket.
const DEFAULT_ORIGINS = [
  "http://localhost:3000", // Next.js dev server
   "http://localhost:5000", 
  "https://chat-app-fe-beta-henna.vercel.app", // deployed frontend (Vercel)
];

const normalize = (o: string) => o.trim().replace(/\/+$/, ""); // "https://x.app/" → "https://x.app"

export const allowedOrigins = [
  ...new Set([...DEFAULT_ORIGINS, ...(process.env.CORS_ORIGINS || "").split(",")].map(normalize)),
].filter(Boolean);

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No origin = curl, Postman, server-to-server: allow.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Not allowed: send no CORS headers, so the browser blocks it.
    // (Passing an Error here would turn every blocked request into a misleading 500.)
    console.warn(`[cors] blocked origin: ${origin}`);
    callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
