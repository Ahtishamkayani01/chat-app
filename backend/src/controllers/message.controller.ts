import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { Message } from "../models/message.model";
import { deleteForEveryone, deleteForMe, refreshLastMessage } from "../services/message.service";
import { getRoomForMember } from "../services/room.service";

// This controller only handles a single message: view, edit, delete.

// GET /api/messages/:messageId/details
export async function getMessageById(req: Request, res: Response) {
  const { messageId } = req.params;
  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  const message = await Message.findById(messageId);
  // also treat a message I hid with "delete for me" as not found
  if (!message || message.deletedFor.includes(req.user!.username)) {
    return res.status(404).json({ message: "Message not found" });
  }
  try {
    await getRoomForMember(String(message.room), req.user!.username);
  } catch {
    return res.status(403).json({ message: "You are not a member of this room" });
  }
  res.json(message);
}

// PUT /api/messages/:messageId/edit   body: { text }
export async function updateMessage(req: Request, res: Response) {
  const { messageId } = req.params;
  const sender = req.user!.username;
  const text = String(req.body.text ?? "").trim();

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  if (!text) {
    return res.status(400).json({ message: "text is required" });
  }

  const message = await Message.findOneAndUpdate(
    { _id: messageId, sender, deletedForEveryone: { $ne: true } }, // only the author, not deleted
    { text, editedAt: new Date() },
    { returnDocument: "after", runValidators: true },
  );
  if (!message) {
    return res.status(404).json({ message: "Message not found or not yours" });
  }
  await refreshLastMessage(message.room);
  res.json(message);
}

// DELETE /api/messages/:messageId/delete?scope=me|everyone
export async function deleteMessage(req: Request, res: Response) {
  const messageId = String(req.params.messageId);
  const username = req.user!.username;
  const scope = req.query.scope === "everyone" ? "everyone" : "me";

  try {
    if (scope === "me") {
      const result = await deleteForMe(messageId, username);
      return res.json(result);
    }
    const { message, lastMessage } = await deleteForEveryone(
      messageId,
      username,
    );
    res.json({ ...message.toJSON(), lastMessage });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    res.status(400).json({ message: msg });
  }
}
