import { Server, Socket } from "socket.io";
import { Message } from "../models/message.model";
import { User, userExists } from "../models/user.model";
import { isValidObjectId } from "mongoose";

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

function broadcast(
  io: Server,
  msg: { sender: string; receiver?: string | null },
  event: string,
  data: unknown,
) {
  if (msg.receiver) {
    io.to(msg.sender).to(msg.receiver).emit(event, data); // only the 2 people
  } else {
    io.emit(event, data); // everyone
  }
}

export function registerMessageHandlers(io: Server, socket: Socket) {
  console.log("handlers registering forn socket", socket.id);

  // JOIN: put this socket in a room named after the user
  socket.on("user:join", (payload, ack) =>
    withAck(ack, async () => {
      const username = str(payload?.username);
      if (!username) throw new Error("username is required");
      // Save the user (create if new, otherwise just update lastSeen)
      await User.updateOne(
        { username },
        { $set: { lastSeen: new Date() } },
        { upsert: true },
      );
      socket.data.username = username; // remember who this socket is
      socket.join(username); //personal roon like me with other person
      return { username };
    }),
  );

  //send
  socket.on("message:send", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[send] received:", payload);

      const sender = socket.data.username;
      const receiver = str(payload?.receiver) || null;
      const text = str(payload?.text);

      if (!sender) throw new Error("Join first");
      if (!text) throw new Error("text is required");
      if (receiver === sender) throw new Error("can't DM yourself");
      if (receiver && !(await userExists(receiver)))
        throw new Error(`User "${receiver}" does not exist`);

      const message = await Message.create({ sender, receiver, text });
      const data = message.toJSON();
      broadcast(io, data, "message:new", data);
      // io.emit("message:new", data); // this is for single
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
      // io.emit("message:updated", data);
      broadcast(io, data, "message:updated", data);

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

      // io.emit("message:deleted", { id });
      broadcast(io, existing, "message:deleted", { id });
      console.log("[delete] broadcast message:deleted", id);

      return { id };
    }),
  );
}
