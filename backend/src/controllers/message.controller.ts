import { Request, Response } from "express";
import { Message } from "../models/message.model";
import { userExists } from "../models/user.model";
import { isValidObjectId } from "mongoose";

//GET /api/messages global only
export async function getMessages(req: Request, res: Response) {
  const message = await Message.find({ receiver: null }).sort({ createdAt: 1 });
  res.json(message);
}

// GET /api/messages/dm?user=ali&with=sara

export async function getDirectMessages(req: Request, res: Response) {
  const user = String(req.query.user || "").trim();
  const other = String(req.query.with || "").trim();
  if (!user || !other)
    return res.status(400).json({ message: "user and with are required" });

  const messages = await Message.find({
    $or: [
      { sender: user, receiver: other },
      { sender: other, receiver: user },
    ],
  }).sort({ createdAt: 1 });
  res.json(messages);
}

// GET /api/messages/conversations?user=ali  WhatsApp-style sidebar list
export async function getConversations(req: Request, res: Response) {
  const user = String(req.query.user || "").trim();
  if (!user) return res.status(400).json({ message: "user is required" });

  const convos = await Message.aggregate([
    { $match: { receiver: { $ne: null }, $or: [{ sender: user }, { receiver: user }] } },
    { $sort: { createdAt: -1 } },
    { $group: {
        _id: { $cond: [{ $eq: ["$sender", user] }, "$receiver", "$sender"] }, // the other person
        lastMessage: { $first: "$$ROOT" },
    } },
    { $sort: { "lastMessage.createdAt": -1 } },
  ]);
  res.json(convos.map((c) => ({ with: c._id, lastMessage: c.lastMessage })));
}

//GET /api/messages/:id
export async function getMessageById(req: Request, res: Response) {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  const message = await Message.findById(id);
  if (!message) {
    return res.status(404).json({ message: "Message not found" });
  }
  res.json(message);
}

// POST /api/messages  (body: { sender, text, receiver? })
export async function createMessage(req: Request, res: Response) {
  const { sender, receiver, text } = req.body;
  if (!sender || !text) {
    return res.status(400).json({ message: "sender and text are required" });
  }
  if (receiver && receiver === sender) {
    return res.status(400).json({ message: "can't DM yourself" });
  }
  if (receiver && !(await userExists(receiver))) {
    return res.status(404).json({ message: `User "${receiver}" does not exist` });
  }
  const message = await Message.create({
    sender,
    receiver: receiver || null,
    text,
  });
  res.status(201).json(message);
}

// PUT /api/messages/:id
export async function updateMessage(req: Request, res: Response) {
  const { id } = req.params;
  const { text } = req.body;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid message id" });
  }
  if (!text) {
    return res.status(400).json({ message: "text is required" });
  }

  const message = await Message.findByIdAndUpdate(
    id,
    { text },
    { returnDocument: "after", runValidators: true },
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
