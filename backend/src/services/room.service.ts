import { Types } from "mongoose";
import { Room } from "../models/room.model";
import { userExists } from "../models/user.model";

export async function globalRoom() {
  const room = await Room.findOneAndUpdate(
    { type: "global" },
    { $setOnInsert: { type: "global", name: "Global Chat" } },
    { upsert: true, returnDocument: "after" },
  );
  return room;
}

export function directKeyOf(a: string, b: string) {
  return [a, b].sort().join(":");
}

export function canAccess(
  room: { type: string; members: string[] },
  username: string,
) {
  return room.type === "global" || room.members.includes(username);
}

export async function getRoomForMember(roomId: string, username: string) {
  if (!Types.ObjectId.isValid(roomId)) {
    throw new Error("Invalid room Id");
  }
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error("Room not Found");
  }
  if (!canAccess(room, username)) {
    throw new Error("You are not a member of this room");
  }
  return room;
}

export async function getOrCreateDirectRoom(a: string, b: string) {
  const userA = a.trim().toLowerCase();
  const userB = b.trim().toLowerCase();
  if (userA === userB) {
    throw new Error("You can't DM yourself");
  }
  if (!(await userExists(userB))) {
    throw new Error(`User "${userB}" does not exist`);
  }
  const directKey = directKeyOf(userA, userB);
  const room = await Room.findOneAndUpdate(
    { directKey },
    {
      $setOnInsert: {
        type: "direct",
        directKey,
        members: [userA, userB],
        createdBy: userA,
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  return room;
}

