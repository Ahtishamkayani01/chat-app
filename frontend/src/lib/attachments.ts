import type { Attachment, AttachmentKind, Message } from "@/types/chat";

// Same list as backend/src/utils/fileKind.ts, so we can reject a file
// before uploading it (the backend still checks again).
const KIND_BY_EXT: Record<string, AttachmentKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  mp4: "video", mov: "video", webm: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", weba: "audio",
  pdf: "document", doc: "document", docx: "document",
  xls: "document", xlsx: "document", ppt: "document", pptx: "document", txt: "document",
  zip: "archive", rar: "archive", "7z": "archive",
};

const MB = 1024 * 1024;
export const MAX_BYTES: Record<AttachmentKind, number> = {
  image: 10 * MB,
  video: 25 * MB,
  audio: 10 * MB,
  document: 10 * MB,
  archive: 10 * MB,
};

/** For <input type="file" accept=...> */
export const ACCEPT = Object.keys(KIND_BY_EXT)
  .map((ext) => `.${ext}`)
  .join(",");

export function extOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function kindOfFile(name: string): AttachmentKind | null {
  return KIND_BY_EXT[extOf(name)] ?? null;
}

/** Returns an error message, or null if the file is OK to upload. */
export function checkFile(file: File): string | null {
  const kind = kindOfFile(file.name);
  if (!kind) return "This file type is not allowed";
  if (file.size > MAX_BYTES[kind]) {
    return `File too large (max ${MAX_BYTES[kind] / MB} MB for ${kind})`;
  }
  return null;
}

// Sidebar label when a message has no caption (same as the backend).
// The icon is drawn by <KindIcon kind=...>, not with emojis.
const LABEL: Record<AttachmentKind, string> = {
  image: "Photo",
  video: "Video",
  audio: "Audio",
  document: "Document",
  archive: "Archive",
};

export function isVoiceNote(a: Pick<Attachment, "kind" | "name">) {
  return a.kind === "audio" && a.name.startsWith("voice-note");
}

/** Sidebar preview for a message: { text, kind } (same shape as room.lastMessage). */
export function messagePreview(m: Pick<Message, "text" | "attachment">) {
  const a = m.attachment;
  if (!a) return { text: m.text };
  return { text: m.text || (isVoiceNote(a) ? "Voice message" : LABEL[a.kind]), kind: a.kind };
}

// Rooms saved before icons existed have emoji text and no kind: convert them.
const LEGACY: Record<string, { text: string; kind: AttachmentKind }> = {
  "📷 Photo": { text: "Photo", kind: "image" },
  "🎥 Video": { text: "Video", kind: "video" },
  "🎤 Voice message": { text: "Voice message", kind: "audio" },
  "📄 Document": { text: "Document", kind: "document" },
  "🗜️ File": { text: "Archive", kind: "archive" },
};

export function normalizePreview(last: { text: string; kind?: AttachmentKind }) {
  return last.kind ? last : (LEGACY[last.text] ?? last);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** 75 → "1:15" */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- Cloudinary CDN URLs ----------
// Cloudinary transforms files on the fly when you add options after "/upload/".

/** Resized + auto format/quality image for the chat bubble (much smaller download). */
export function imageThumbUrl(a: Attachment) {
  return a.url.replace("/upload/", "/upload/c_limit,w_720,q_auto,f_auto/");
}

/** Deliver audio as mp3 so every browser (incl. Safari) can play voice notes. */
export function audioUrl(a: Attachment) {
  return a.url.replace(/\.[a-z0-9]+$/i, ".mp3");
}
