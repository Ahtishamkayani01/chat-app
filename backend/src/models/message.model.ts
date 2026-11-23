import { Schema, model, Types } from "mongoose";
export type AttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive";

export interface Iattachment {
  kind: AttachmentKind;
  url: string;
  publicId: string; // Cloudinary id,
  name: string; // original file name, e.g. "report.pdf"
  ext: string; // "pdf", "docx", "zip"... used for the icon
  mimeType: string;
  size: number; // bytes
  thumbnailUrl?: string; // video poster image
  duration?: number; // seconds (audio/video)
  width?: number;
  height?: number;
}
export interface Imessage {
  room: Types.ObjectId;
  sender: string;
  text: string;
  attachment?: Iattachment;
  deletedFor: string[];
  deletedForEveryone: boolean;
  deletedAt?: Date;
}

const attachmentSchema = new Schema<Iattachment>(
  {
    kind: {
      type: String,
      enum: ["image", "video", "audio", "document", "archive"],
      required: true,
    },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxLength: 200 },
    ext: { type: String, required: true, lowercase: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    thumbnailUrl: String,
    duration: Number,
    width: Number,
    height: Number,
  },
  { _id: false }, // it's part of the message, so it doesn't need its own id
);

const messageSchema = new Schema<Imessage>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    sender: { type: String, required: true, trim: true },
    text: { type: String, trim: true, maxLength: 1000, default: "" },
    attachment: { type: attachmentSchema, required: false },
    deletedFor: { type: [String], default: [] },
    deletedForEveryone: { type: Boolean, default: false },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      // Who hid a message is private: never send deletedFor to clients
      transform(_doc, ret: Partial<Imessage>) {
        delete ret.deletedFor;
        return ret;
      },
    },
  },
);
messageSchema.pre("validate", function () {
  if (this.deletedForEveryone) return; // placeholder has no content, that's fine
  if (!this.text && !this.attachment) {
    this.invalidate("text", "Message needs text or an attachment");
  }
});
messageSchema.index({ room: 1, createdAt: 1 });

export const Message = model<Imessage>("Message", messageSchema);
