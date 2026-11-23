import { Server, Socket } from "socket.io";
import { Message } from "../models/message.model";
import { User } from "../models/user.model";
import { isValidObjectId, Types } from "mongoose";
import { Room } from "../models/room.model";
import { deleteForEveryone, deleteForMe, refreshLastMessage, sendMessage } from "../services/message.service";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
//helper
type AckResponse = { ok: true; data?: unknown } | { ok: false; error: string };
type Ack = (res: AckResponse) => void;

async function withAck(ack: unknown, fn: () => Promise<unknown>) {
  // If the client didn't send a callback, use a do-nothing function so nothing crashes.
  const reply = typeof ack === "function" ? (ack as Ack) : () => {};

  try {
    const data = await fn(); // run the actual work
    console.log("[withAck] ✓ ok");
    reply({ ok: true, data }); // reply success with whatever fn returned
  } catch (err) {
    const error = err instanceof Error ? err.message : "Something went wrong";
    console.log("[withAck] ✗ error:", error);
    reply({ ok: false, error }); // reply failure
  }
}

async function broadcast(
  io: Server,
  roomId: Types.ObjectId | string,
  event: string,
  data: unknown,
) {
  const room = await Room.findById(roomId);
  if (!room) return;
  if (room.type === "global") {
    io.emit(event, data);
  } else {
    const channels = room.members.map((m) => `user:${m}`);
    io.to(channels).emit(event, data);
  }
}

export function registerMessageHandlers(io: Server, socket: Socket) {
  console.log("handlers registering forn socket", socket.id);

  // JOIN: the user is already known from the token (see io.use in index.ts)
  socket.on("user:join", (_payload, ack) =>
    withAck(ack, async () => {
      const username = socket.data.username as string;
      await User.updateOne({ username }, { $set: { lastSeen: new Date() } }); // no upsert
      socket.join(`user:${username}`); // personal channel for DMs/groups
      return { username };
    }),
  );

  //send
  socket.on("message:send", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[send] received:", payload);

      const sender = socket.data.username;
      if (!sender) throw new Error("Join first");

      // payload: { roomId, text?, attachment? }
      const { message, room } = await sendMessage(
        str(payload?.roomId),
        sender,
        str(payload?.text),
        payload?.attachment,
      );

      const data = message.toJSON();
      await broadcast(io, room._id, "message:new", data);
      console.log("[send] broadcast message:new", data._id);

      return data; // withAck sends this back as { ok: true, data }
    }),
  );

  //Edit
  socket.on("message:edit", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[edit] received:", payload);

      const id = str(payload?.id);
      const text = str(payload?.text);
      if (!isValidObjectId(id)) throw new Error("Invalid message id");
      if (!text) throw new Error("text is required");

      const existing = await Message.findById(id);
      if (!existing) throw new Error("Message not found");
      if (existing.sender !== socket.data.username)
        throw new Error("Not your message");
      if (existing.deletedForEveryone)
        throw new Error("Can't edit a deleted message");
      const message = await Message.findByIdAndUpdate(
        id,
        { text },
        { returnDocument: "after", runValidators: true },
      ); // return the UPDATED doc);
      if (!message) throw new Error("Message not found");
      await refreshLastMessage(message.room); // in case it was the newest message
      const data = message.toJSON();
      await broadcast(io, message.room, "message:updated", data);

      console.log("[edit] broadcast message:updated", id);
      return data; // withAck sends this back as { ok: true, data }
    }),
  );

  // DELETE   payload: { id, scope: "me" | "everyone" }
  socket.on("message:delete", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[delete] received:", payload);

      const username = socket.data.username as string;
      const id = str(payload?.id);
      const scope = payload?.scope === "everyone" ? "everyone" : "me";

      if (scope === "me") {
        const result = await deleteForMe(id, username);
        // only MY tabs: nobody else's chat changes
        io.to(`user:${username}`).emit("message:deleted", result);
        console.log("[delete] for me", id);
        return result;
      }

      const { message, lastMessage } = await deleteForEveryone(id, username);
      const data = { ...message.toJSON(), lastMessage };
      await broadcast(io, message.room, "message:updated", data);
      console.log("[delete] for everyone", id);
      return data;
    }),
  );
}
