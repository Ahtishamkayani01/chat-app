import { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { AttachmentKind, Iattachment } from "../models/message.model";
import { extOf, kindOf, MAX_BYTES } from "../utils/fileKind";
import cloudinary from "../config/cloudinary";

// Cloudinary has 3 buckets: image, video (audio goes here too), raw (anything else)
function resourceTypeOf(kind: AttachmentKind): "image" | "video" | "raw" {
  if (kind === "image") return "image";
  if (kind === "video" || kind === "audio") return "video";
  return "raw"; // pdf, docx, zip...
}
// upload_stream uses a callback, so we wrap it in a Promise to use await
function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Upload failed"));
      resolve(result);
    });
    stream.end(buffer); // push the file bytes from RAM into the stream
  });
}

export async function uploadAttachment(
  file: Express.Multer.File,
  username: string,
): Promise<Iattachment> {
  const kind = kindOf(file.originalname);
  if (!kind) throw new Error("This file type is not allowed");

  const maxBytes = MAX_BYTES[kind];
  if (file.size > maxBytes) {
    throw new Error(
      `File too large (max ${maxBytes / 1024 / 1024} MB for ${kind})`,
    );
  }
  const ext = extOf(file.originalname);
  const resourceType = resourceTypeOf(kind);
  const result = await uploadBuffer(file.buffer, {
    resource_type: resourceType,
    folder: `chat-app/${username}`,
    // raw files only keep their extension if it's part of the public_id
    ...(resourceType === "raw" && { public_id: `${Date.now()}.${ext}` }),
  });

  // Video poster: Cloudinary makes a jpg from the frame at 1 second
  const thumbnailUrl =
    kind === "video"
      ? cloudinary.url(result.public_id, {
          resource_type: "video",
          format: "jpg",
          secure: true,
          transformation: [{ start_offset: "1" }],
        })
      : undefined;
  return {
    kind,
    url: result.secure_url,
    publicId: result.public_id,
    name: file.originalname,
    ext,
    mimeType: file.mimetype,
    size: file.size,
    thumbnailUrl,
    duration: result.duration, // only set for audio/video
    width: result.width, // only set for image/video
    height: result.height,
  };
}

// Remove the file from Cloudinary when its message is deleted
export async function deleteAttachmentFile(attachment: Iattachment) {
  try {
    await cloudinary.uploader.destroy(attachment.publicId, {
      resource_type: resourceTypeOf(attachment.kind),
      invalidate: true, // clear the CDN cache too
    });
  } catch (err) {
    // Don't fail the delete just because Cloudinary had a problem
    console.error("[cloudinary] destroy failed:", attachment.publicId, err);
  }
}
