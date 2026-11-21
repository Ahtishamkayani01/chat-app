import { Message } from "../models/message.model";
import { getRoomForMember } from "./room.service";

export async function sendMessage(
  roomId: string,
  sender: string,
  text: string,
) {
  const username = sender.trim().toLowerCase();
  const body = text.trim();
  if (!username || !body) {
    throw new Error("Sender and text are required");
  }
  if (body.length > 1000) {
    throw new Error("Message is too long (max 1000 characters)");
  }

  const room = await getRoomForMember(roomId, username);
  const message = await Message.create({
    room: room._id,
    sender: username,
    text: body,
  });
  room.lastMessage = {
    text: body,
    sender: username,
    at: message.get("createdAt"),
  };
  await room.save();
  return { message, room };
}

export async function getRoomMessages(roomId: string, username: string) {
  const room = await getRoomForMember(roomId, username);
  return Message.find({ room: room._id }).sort({ createdAt: 1 });
}
