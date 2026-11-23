import { Request, Response } from "express";
import {
  addGroupMembers,
  createGroup,
  getOrCreateDirectRoom,
  globalRoom,
  leaveGroup,
  removeGroupMember,
  renameGroup,
} from "../services/room.service";
import { Room } from "../models/room.model";
import { getRoomMessages, sendMessage } from "../services/message.service";
import { emitToUsers } from "../socket/io";

const str = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();
//GET /api/rooms/my-rooms  sidebar: global room + every room I'm in
export async function getMyRooms(req: Request, res: Response) {
  const user = req.user!.username;
  const global = await globalRoom();
  const rooms = await Room.find({ members: user }).sort({
    "lastMessage.at": -1,
  });
  res.json([global, ...rooms]);
}

//POST /api/rooms/direct/open  body: { with }
export async function openDirectRoom(req: Request, res: Response) {
  try {
    const room = await getOrCreateDirectRoom(
      req.user!.username,
      str(req.body.with),
    );
    res.json(room);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//GET /api/rooms/:roomId/messages/history  (chat history)
export async function listRoomMessages(req: Request, res: Response) {
  try {
    const messages = await getRoomMessages(
      String(req.params.roomId),
      req.user!.username,
    );
    res.json(messages);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//POST /api/rooms/:roomId/messages/send  body: { text }
export async function postRoomMessage(req: Request, res: Response) {
  try {
    const { message } = await sendMessage(
      String(req.params.roomId),
      req.user!.username,
      String(req.body.text ?? ""),
      req.body.attachment,
    );
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//POST /api/rooms/group/create  body: { name, members: ["ali", "sara"] }
export async function createGroupRoom(req: Request, res: Response) {
  try {
    const members = Array.isArray(req.body.members) ? req.body.members : [];
    const room = await createGroup(
      req.user!.username,
      String(req.body.name ?? ""),
      members,
    );
    res.status(201).json(room);
    emitToUsers(room.members, "room:new", room.toJSON());
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

// ---------- groups: manage members / name ----------
// Live events sent to members:
//   room:new      → you were added: put the group in your sidebar
//   room:updated  → name / members / admins changed: replace your copy
//   room:removed  → you're no longer in it: drop it from your sidebar

const roomIdOf = (req: Request) => String(req.params.roomId);

//POST /api/rooms/:roomId/members/add  body: { usernames: ["ali"] }   (admin)
export async function addMembers(req: Request, res: Response) {
  try {
    const usernames = Array.isArray(req.body.usernames) ? req.body.usernames : [];
    const { room, added } = await addGroupMembers(
      roomIdOf(req),
      req.user!.username,
      usernames,
    );
    const data = room.toJSON();
    const existing = room.members.filter((m) => !added.includes(m));
    emitToUsers(added, "room:new", data); // new people: group appears in their sidebar
    emitToUsers(existing, "room:updated", data); // everyone else: member list changed
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//POST /api/rooms/:roomId/members/remove  body: { username }   (admin)
export async function removeMember(req: Request, res: Response) {
  try {
    const target = str(req.body.username);
    const room = await removeGroupMember(roomIdOf(req), req.user!.username, target);
    const data = room.toJSON();
    emitToUsers([target], "room:removed", { roomId: roomIdOf(req) }); // kicked: drop from sidebar
    emitToUsers(room.members, "room:updated", data);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//POST /api/rooms/:roomId/leave   (any member; their messages stay in the group)
export async function leaveRoom(req: Request, res: Response) {
  try {
    const me = req.user!.username;
    const room = await leaveGroup(roomIdOf(req), me);
    emitToUsers([me], "room:removed", { roomId: roomIdOf(req) }); // my other tabs/devices
    emitToUsers(room.members, "room:updated", room.toJSON());
    res.json({ roomId: roomIdOf(req) });
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//PUT /api/rooms/:roomId/rename  body: { name }   (admin)
export async function renameRoom(req: Request, res: Response) {
  try {
    const room = await renameGroup(
      roomIdOf(req),
      req.user!.username,
      String(req.body.name ?? ""),
    );
    const data = room.toJSON();
    emitToUsers(room.members, "room:updated", data);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}
