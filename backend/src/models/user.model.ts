import { Schema, model } from "mongoose";
import { Message } from "./message.model";

export interface IUser {
  username: string;
  email: string;
  password: string;
  lastSeen: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxLength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const User = model<IUser>("User", userSchema);

/**
 * A user exists if they have joined (User collection) OR have sent a message.
 * The message check covers people who chatted before the User collection existed.
 */
export async function userExists(username: string): Promise<boolean> {
  if (await User.exists({ username })) return true;
  return Boolean(await Message.exists({ sender: username }));
}
