import { Schema, model } from "mongoose";

export interface Imessage {
  sender: string;
  receiver?: string | null;
  text: string;
}

const messageSchema = new Schema<Imessage>(
  {
    sender: { type: String, required: true, trim: true },
    receiver: { type: String, default: null, trim: true },
    text: { type: String, required: true, trim: true, maxLength: 1000 },
  },
  { timestamps: true },
);
messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
export const Message = model<Imessage>("Message", messageSchema);
