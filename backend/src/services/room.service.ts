import { Types } from "mongoose";
import { Room } from "../models/room.model";
import { User, userExists } from "../models/user.model";

const MAX_GROUP_MEMBERS = 50;

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

function cleanUsernames(names: unknown[]): string[] {
  const cleaned = names
    .map((n) =>
      String(n ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
  return [...new Set(cleaned)];
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

export async function createGroup(
  creator: string,
  name: string,
  memberNames: unknown[],
) {
  const me = creator.trim().toLowerCase();
  const groupName = name.trim();
  if (!groupName) throw new Error("Group name is required");
  if (groupName.length > 50)
    throw new Error("Group name is too long (max 50 characters)");
  // Everyone except me (I'm added automatically as member + admin)
  const others = cleanUsernames(memberNames).filter((n) => n !== me);
  if (others.length === 0) throw new Error("Add at least one member");
  if (others.length + 1 > MAX_GROUP_MEMBERS) {
    throw new Error(`A group can have at most ${MAX_GROUP_MEMBERS} members`);
  }

  // One query for all of them, instead of one query per user
  const found: string[] = await User.find({
    username: { $in: others },
  }).distinct("username");
  const missing = others.filter((n) => !found.includes(n));
  if (missing.length) throw new Error(`User not found: ${missing.join(", ")}`);

  return Room.create({
    type: "group",
    name: groupName,
    members: [me, ...others],
    admins: [me], // creator is the first admin
    createdBy: me,
  });
}

// Load a group and make sure `username` is in it (and is an admin, if required)
async function getGroup(roomId: string, username: string, adminOnly = false) {
  const room = await getRoomForMember(roomId, username); // checks id, exists, member
  if (room.type !== "group") throw new Error("This is not a group");
  if (adminOnly && !room.admins.includes(username)) {
    throw new Error("Only group admins can do this");
  }
  return room;
}

export async function addGroupMembers(
  roomId: string,
  by: string,
  usernames: unknown[],
) {
  const room = await getGroup(roomId, by, true);

  const toAdd = cleanUsernames(usernames).filter(
    (n) => !room.members.includes(n),
  );
  if (toAdd.length === 0) throw new Error("They are already in the group");
  if (room.members.length + toAdd.length > MAX_GROUP_MEMBERS) {
    throw new Error(`A group can have at most ${MAX_GROUP_MEMBERS} members`);
  }

  const found: string[] = await User.find({
    username: { $in: toAdd },
  }).distinct("username");
  const missing = toAdd.filter((n) => !found.includes(n));
  if (missing.length) throw new Error(`User not found: ${missing.join(", ")}`);

  room.members.push(...toAdd);
  await room.save();
  return { room, added: toAdd };
}

export async function removeGroupMember(
  roomId: string,
  by: string,
  username: string,
) {
  const room = await getGroup(roomId, by, true);
  const target = username.trim().toLowerCase();

  if (target === by) throw new Error("Use 'Leave group' to remove yourself");
  if (!room.members.includes(target))
    throw new Error(`${target} is not in this group`);

  room.members = room.members.filter((m) => m !== target);
  room.admins = room.admins.filter((a) => a !== target); // removed admins lose admin too
  await room.save();
  return room;
}

export async function leaveGroup(roomId: string, username: string) {
  const room = await getGroup(roomId, username);

  room.members = room.members.filter((m) => m !== username);
  room.admins = room.admins.filter((a) => a !== username);

  // Last admin left (and people are still in it): the longest-standing member becomes admin
  if (room.admins.length === 0 && room.members.length > 0) {
    room.admins = [room.members[0]];
  }

  // Messages and files are never deleted: they stay in the group's history.
  // If nobody is left, the room simply has no members and appears in nobody's sidebar.
  await room.save();
  return room;
}

export async function renameGroup(roomId: string, by: string, name: string) {
  const room = await getGroup(roomId, by, true);
  const groupName = name.trim();
  if (!groupName) throw new Error("Group name is required");
  if (groupName.length > 50)
    throw new Error("Group name is too long (max 50 characters)");

  room.name = groupName;
  await room.save();
  return room;
}
