import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { isValidObjectId } from "mongoose";

//GET /api/messages
export async function getMessages(req: Request, res: Response) {
  const message = await Message.find().sort({ createdAt: 1 });
  res.json(message);
}

//GET /api/messages/:id
export async function getMessageById(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ Message: "Invalid Message ID" });
  }
  const message = await Message.findById(id);
  if (!message) {
    return res.status(400).json({ message: "Message not found" });
  }
  res.json(message);
}

//POST /api/message
export async function createMessage(req: Request, res: Response) {
  const { sender, text } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ message: "sender and text is required" });
  }
  const message = await Message.create({
    sender: sender,
    text: text,
  });
  res.status(201).json(message);
}

//PUT /api/message/:id
export async function updateMessage(req: Request, res: Response) {
  const { id } = req.params;
  const { text } = req.body;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ Message: "Invalid Message ID" });
  }
  if (!text) {
    return res.status(400).json({ message: "text is required" });
  }

  const message = await Message.findByIdAndUpdate(
    id,
    { text },
    { new: true, runValidators: true },
  );
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  res.json(message);
}

// DELETE /api/messages/:id
export async function deleteMessage(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  const message = await Message.findByIdAndDelete(id);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  res.json({ message: "Message deleted" });
}
