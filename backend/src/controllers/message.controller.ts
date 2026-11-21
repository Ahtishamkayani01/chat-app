import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { isValidObjectId } from "mongoose";

// This controller only handles a single message: view, edit, delete.

const str = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

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

// PUT /api/messages/:messageId/edit   body: { sender, text }
export async function updateMessage(req: Request, res: Response) {
  const { messageId } = req.params;
  const sender = str(req.body.sender);
  const text = String(req.body.text ?? "").trim();

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  if (!sender || !text) {
    return res.status(400).json({ message: "sender and text are required" });
  }

  const message = await Message.findOneAndUpdate(
    { _id: messageId, sender }, // only the author can edit
    { text },
    { returnDocument: "after", runValidators: true },
  );
  if (!message) {
    return res.status(404).json({ message: "Message not found or not yours" });
  }
  res.json(message);
}

// DELETE /api/messages/:messageId/delete   body: { sender }
export async function deleteMessage(req: Request, res: Response) {
  const { messageId } = req.params;
  const sender = str(req.body.sender);

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  if (!sender) {
    return res.status(400).json({ message: "sender is required" });
  }

  const message = await Message.findOneAndDelete({ _id: messageId, sender }); 
  if (!message) {
    return res.status(404).json({ message: "Message not found or not yours" });
  }
  res.json({ message: "Message deleted" });
}
