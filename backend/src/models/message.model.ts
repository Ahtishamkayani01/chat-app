import { Schema, model } from "mongoose";

export interface Imessage {
  sender: string;
  text: string;
}

const messageSchema = new Schema<Imessage>(
  {
    sender: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxLength: 1000 },
  },
  { timestamps: true },
);

export const Message = model<Imessage>("Message", messageSchema);

