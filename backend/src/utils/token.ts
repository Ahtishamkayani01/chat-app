import Jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET as string;

export function signToken(username: string) {
  return Jwt.sign({ username }, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return Jwt.verify(token, SECRET) as { username: string };
}
