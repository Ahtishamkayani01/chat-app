import { AttachmentKind, Iattachment, Message } from "../models/message.model";
import { kindOf } from "../utils/fileKind";
import { getRoomForMember } from "./room.service";
import { Room } from "../models/room.model";
import { Types } from "mongoose";

// Sidebar label when a message has no caption. No emojis here: the frontend
// draws a proper icon from lastMessage.kind (emojis look different on every OS).
const LABEL: Record<AttachmentKind, string> = {
  image: "Photo",
  video: "Video",
  audio: "Audio",
  document: "Document",
  archive: "Archive",
};

/** Sidebar preview for a message: its text (or a label) + the file kind for the icon. */
function previewOf(text: string, attachment?: Iattachment) {
  if (!attachment) return { text };
  const label =
    attachment.kind === "audio" && attachment.name.startsWith("voice-note")
      ? "Voice message"
      : LABEL[attachment.kind];
  return { text: text || label, kind: attachment.kind };
}

// The client sends back the object from /api/uploads/attachment.
// Never trust it blindly: the file must be on OUR Cloudinary, in THIS user's folder.
function cleanAttachment(
  raw: unknown,
  username: string,
): Iattachment | undefined {
  if (!raw) return undefined; // text-only message
  const a = raw as Partial<Iattachment>;
  const base = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;

  if (typeof a.url !== "string" || !a.url.startsWith(base)) {
    throw new Error("Invalid attachment URL");
  }
  if (
    typeof a.publicId !== "string" ||
    !a.publicId.startsWith(`chat-app/${username}/`)
  ) {
    throw new Error("Invalid attachment");
  }
  if (typeof a.name !== "string" || !a.kind || kindOf(a.name) !== a.kind) {
    throw new Error("Invalid attachment type");
  }
  if (a.thumbnailUrl && !String(a.thumbnailUrl).startsWith(base)) {
    throw new Error("Invalid thumbnail URL");
  }

  // Copy only the fields we know about, so nothing extra gets into the DB
  return {
    kind: a.kind,
    url: a.url,
    publicId: a.publicId,
    name: a.name,
    ext: String(a.ext ?? ""),
    mimeType: String(a.mimeType ?? "application/octet-stream"),
    size: Number(a.size) || 0,
    thumbnailUrl: a.thumbnailUrl,
    duration: a.duration != null ? Number(a.duration) : undefined,
    width: a.width != null ? Number(a.width) : undefined,
    height: a.height != null ? Number(a.height) : undefined,
  };
}

export async function sendMessage(
  roomId: string,
  sender: string,
  text: string,
  rawAttachment?: unknown,
) {
  const username = sender.trim().toLowerCase();
  const body = text.trim();
  const attachment = cleanAttachment(rawAttachment, username);

  if (!username) throw new Error("Sender is required");
  if (!body && !attachment)
    throw new Error("Message needs text or an attachment");
  if (body.length > 1000)
    throw new Error("Message is too long (max 1000 characters)");

  const room = await getRoomForMember(roomId, username);
  const message = await Message.create({
    room: room._id,
    sender: username,
    text: body,
    attachment,
  });

  room.lastMessage = {
    ...previewOf(body, attachment), // "Photo" + kind "image" when there's no caption
    sender: username,
    at: message.get("createdAt"),
  };
  await room.save();
  return { message, room };
}

/**
 * Recompute a room's sidebar preview from its newest remaining message.
 * Call after a delete or an edit, otherwise the sidebar keeps showing
 * the old text (e.g. "Document" after the document was deleted).
 * Returns the new preview (null = the room has no messages left).
 */
export async function refreshLastMessage(roomId: Types.ObjectId | string) {
  const latest = await Message.findOne({ room: roomId }).sort({ createdAt: -1 });
  const lastMessage = latest
    ? {
        ...previewOf(latest.text, latest.attachment ?? undefined),
        sender: latest.sender,
        at: latest.get("createdAt") as Date,
      }
    : null;
  await Room.updateOne(
    { _id: roomId },
    lastMessage ? { $set: { lastMessage } } : { $unset: { lastMessage: 1 } },
  );
  return lastMessage;
}

export async function getRoomMessages(roomId: string, username: string) {
  const room = await getRoomForMember(roomId, username);
  return Message.find({ room: room._id }).sort({ createdAt: 1 });
}
