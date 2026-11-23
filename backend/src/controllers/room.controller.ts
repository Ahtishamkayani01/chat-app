import { Request, Response } from "express";
import { getOrCreateDirectRoom, globalRoom } from "../services/room.service";
import { Room } from "../models/room.model";
import { getRoomMessages, sendMessage } from "../services/message.service";

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
