import { Request, Response } from "express";
import { userExists } from "../models/user.model";

// GET /api/users/:username  → 200 { username } if they exist, 404 otherwise
export async function getUser(req: Request, res: Response) {
  const username = String(req.params.username || "").trim();
  if (!username) return res.status(400).json({ message: "username is required" });

  if (!(await userExists(username))) {
    return res.status(404).json({ message: `User "${username}" does not exist` });
  }
  res.json({ username });
}
