import { Schema, model, Types } from "mongoose";
import type { AttachmentKind } from "./message.model";

export type RoomType = "global" | "direct" | "group";

export interface IRoom {
  type: RoomType;
  name?: string; // groups only
  members: string[]; // usernames (empty for global = everyone)
  admins: string[]; // groups only
  directKey?: string; // DMs only
  createdBy?: string;
  // kind is set when the last message has a file, so the sidebar can show its icon
  lastMessage?: { text: string; sender: string; at: Date; kind?: AttachmentKind };
}

const roomSchema = new Schema<IRoom>(
  {
    type: { type: String, enum: ["global", "direct", "group"], required: true },
    name: { type: String, trim: true, maxLength: 50 },
    members: { type: [String], default: [] },
    admins: { type: [String], default: [] },
    directKey: { type: String, unique: true, sparse: true }, // no duplicate DMs
    createdBy: String,
    lastMessage: { text: String, sender: String, at: Date, kind: String },
  },
  { timestamps: true },
);

roomSchema.index({ members: 1, "lastMessage.at": -1 });

export const Room = model<IRoom>("Room", roomSchema);
export type RoomId = Types.ObjectId;
