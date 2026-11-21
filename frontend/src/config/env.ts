// Backend domain config: the one place that says where the backend lives.
// REST and Socket.IO are served by the same server, so they share this one URL.
// Override per environment with NEXT_PUBLIC_BACKEND_URL (e.g. http://localhost:5000 in .env.local).

const DEFAULT_BACKEND_URL = "https://chat-app-production-226e1fa5.up.railway.app";

// Strip trailing slashes so "https://x.app/" never produces "https://x.app//api".
export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL).replace(
  /\/+$/,
  "",
);

export const API_BASE_URL = `${BACKEND_URL}/api`; // REST routes live under /api
