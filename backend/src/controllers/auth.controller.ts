import { Request, Response } from "express";
import { User } from "../models/user.model";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/token";

export async function register(req: Request, res: Response) {
  const username = String(req.body.username ?? "")
    .trim()
    .toLowerCase();
  const email = String(req.body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password ?? "");
  if (!username || !email || password.length < 6) {
    return res
      .status(400)
      .json({ message: "username, email and password (min 6) are required" });
  }

  //Email already taken
  const taken = await User.exists({ $or: [{ username }, { email }] });
  if (taken)
    return res
      .status(409)
      .json({ message: "Username or email already in use" });

  const hash = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hash });
  res.status(201).json({ token: signToken(username), username });
}

//POST /api/auth/login
export async function login(req: Request, res: Response) {
  const identifier = String(req.body.identifier ?? "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password ?? "");

  if (!identifier || !password) {
    return res
      .status(400)
      .json({ message: "username/email and password are required" });
  }

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  }).select("+password");

  const ok = user && (await bcrypt.compare(password, user.password));
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });

  res.json({ token: signToken(user.username), username: user.username });
}
