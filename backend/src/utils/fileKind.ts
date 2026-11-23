import { AttachmentKind } from "../models/message.model";

const KIND_BY_EXT: Record<string, AttachmentKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  weba: "audio",
  pdf: "document",
  doc: "document",
  docx: "document",
  xls: "document",
  xlsx: "document",
  ppt: "document",
  pptx: "document",
  txt: "document",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
};

// Cloudinary free plan limits: 10 MB for images/raw files, 100 MB for video
export const MAX_BYTES: Record<AttachmentKind, number> = {
  image: 10 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  document: 10 * 1024 * 1024,
  archive: 10 * 1024 * 1024,
};

export function extOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function kindOf(filename: string): AttachmentKind | null {
  return KIND_BY_EXT[extOf(filename)] ?? null;
}
