import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { isValidObjectId } from "mongoose";
import { deleteAttachmentFile } from "../services/upload.service";
import { refreshLastMessage } from "../services/message.service";

// This controller only handles a single message: view, edit, delete.

// GET /api/messages/:messageId/details
export async function getMessageById(req: Request, res: Response) {
  const { messageId } = req.params;
  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  const message = await Message.findById(messageId);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
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
    { _id: messageId, sender }, // only the author can edit
    { text },
    { returnDocument: "after", runValidators: true },
  );
  if (!message) {
    return res.status(404).json({ message: "Message not found or not yours" });
  }
  await refreshLastMessage(message.room);
  res.json(message);
}

// DELETE /api/messages/:messageId/delete
export async function deleteMessage(req: Request, res: Response) {
  const { messageId } = req.params;
  const sender = req.user!.username;

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  const message = await Message.findOneAndDelete({ _id: messageId, sender });
  if (!message) {
    return res.status(404).json({ message: "Message not found or not yours" });
  }
  if (message.attachment) {
    await deleteAttachmentFile(message.attachment);
  }
  await refreshLastMessage(message.room);
  res.json({ message: "Message deleted" });
}
