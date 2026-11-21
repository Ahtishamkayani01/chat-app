import { Schema, model, Types } from "mongoose";

export interface Imessage {
  room: Types.ObjectId;
  sender: string;
  text: string;
}

const messageSchema = new Schema<Imessage>(
  {
    room: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    sender: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxLength: 1000 },
  },
  { timestamps: true },
);

messageSchema.index({ room: 1, createdAt: 1 }); 

export const Message = model<Imessage>("Message", messageSchema);