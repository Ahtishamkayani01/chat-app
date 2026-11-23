export type RoomType = "global" | "direct" | "group";

export type AttachmentKind = "image" | "video" | "audio" | "document" | "archive";

export interface Attachment {
  kind: AttachmentKind;
  url: string; // Cloudinary CDN URL
  publicId: string;
  name: string; // "report.pdf"
  ext: string; // "pdf"
  mimeType: string;
  size: number; // bytes
  thumbnailUrl?: string; // video poster
  duration?: number; // seconds (audio/video)
  width?: number;
  height?: number;
}

export interface Message {
  _id: string;
  room: string; // room id this message belongs to
  sender: string;
  text: string; // "" when the message is only an attachment
  attachment?: Attachment;
  deletedForEveryone?: boolean; // sender deleted it: show a placeholder
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type DeleteScope = "me" | "everyone";

export interface Room {
  _id: string;
  type: RoomType;
  name?: string; // groups only
  members: string[]; // usernames (empty for global = everyone)
  admins: string[];
  directKey?: string;
  createdBy?: string;
  lastMessage?: { text: string; sender: string; at: string; kind?: AttachmentKind };
  createdAt: string;
  updatedAt: string;
}
