import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/token";
// Let TypeScript know req.user exists
declare global {
  namespace Express {
    interface Request {
      user?: { username: string };
    }
  }
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Not logged in" });
  try {
    req.user = verifyToken(token);
    next(); // token OK  go to the route
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
