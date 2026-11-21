import { Request, Response } from "express";
import { getOrCreateDirectRoom, globalRoom } from "../services/room.service";
import { Room } from "../models/room.model";
import { getRoomMessages, sendMessage } from "../services/message.service";

const str = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();
//GET /api/rooms/my-rooms?user=ahtisham  sidebar: global room + every room I'm in
export async function getMyRooms(req: Request, res: Response) {
  const user = str(req.query.user);
  if (!user) return res.status(400).json({ message: "User is required" });
  const global = await globalRoom();
  const rooms = await Room.find({ members: user }).sort({
    "lastMessage.at": -1,
  });
  res.json([global, ...rooms]);
}

//POST /api/rooms/direct/open  body: { user, with }
export async function openDirectRoom(req: Request, res: Response) {
  try {
    const room = await getOrCreateDirectRoom(
      str(req.body.user),
      str(req.body.with),
    );
    res.json(room);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//GET /api/rooms/:roomId/messages/history?user=ahtisham  (chat history)
export async function listRoomMessages(req: Request, res: Response) {
  try {
    const messages = await getRoomMessages(
      String(req.params.roomId),
      str(req.query.user),
    );
    res.json(messages);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}

//POST /api/rooms/:roomId/messages/send  body: { sender, text }
export async function postRoomMessage(req: Request, res: Response) {
  try {
    const { message } = await sendMessage(
      String(req.params.roomId),
      str(req.body.sender),
      String(req.body.text ?? ""),
    );
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}
