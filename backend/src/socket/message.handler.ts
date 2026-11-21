import { Server, Socket } from "socket.io";
import { Message } from "../models/message.model";
import { User } from "../models/user.model";
import { isValidObjectId, Types } from "mongoose";
import { Room } from "../models/room.model";
import { sendMessage } from "../services/message.service";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const uname = (v: unknown) => str(v).toLowerCase();
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

  // JOIN
  socket.on("user:join", (payload, ack) =>
    withAck(ack, async () => {
      const username = uname(payload?.username);
      if (!username) throw new Error("username is required");
      // Save the user (create if new, otherwise just update lastSeen)
      await User.updateOne(
        { username },
        { $set: { lastSeen: new Date() } },
        { upsert: true },
      );
      socket.data.username = username; // remember who this socket is
      socket.join(`user:${username}`); //personal room like me with other person
      return { username };
    }),
  );

  //send
  socket.on("message:send", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[send] received:", payload);

      const sender = socket.data.username;
      if (!sender) throw new Error("Join first");

      // payload: { roomId, text }. sendMessage validates text + room membership
      const { message, room } = await sendMessage(
        str(payload?.roomId),
        sender,
        str(payload?.text),
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

      const message = await Message.findByIdAndUpdate(
        id,
        { text },
        { returnDocument: "after", runValidators: true },
      ); // return the UPDATED doc);
      if (!message) throw new Error("Message not found");
      const data = message.toJSON();
      await broadcast(io, message.room, "message:updated", data);

      console.log("[edit] broadcast message:updated", id);
      return data; // withAck sends this back as { ok: true, data }
    }),
  );

  // DELETE
  socket.on("message:delete", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[delete] received:", payload);

      const id = str(payload?.id);
      if (!isValidObjectId(id)) throw new Error("Invalid message id");
      // Find first, check owner, then delete
      const existing = await Message.findById(id);
      if (!existing) throw new Error("Message not found");
      if (existing.sender !== socket.data.username)
        throw new Error("Not your message");

      await Message.findByIdAndDelete(id);

      const result = { id, roomId: String(existing.room) }; // client needs roomId to update the right chat
      await broadcast(io, existing.room, "message:deleted", result);
      console.log("[delete] broadcast message:deleted", id);

      return result;
    }),
  );
}
