import { Server, Socket } from "socket.io";
import { Message } from "../models/message.model";
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

export function registerMessageHandlers(io: Server, socket: Socket) {
  console.log("handlers registering forn socket", socket.id);
  //send
  socket.on("message:send", (payload, ack) =>
    withAck(ack, async () => {
      console.log("[send] received:", payload);

      const sender = str(payload?.sender);
      const text = str(payload?.text);
      if (!sender || !text) throw new Error("sender and text are required");

      const message = await Message.create({ sender, text });
      const data = message.toJSON();
      io.emit("message:new", data);
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

      const message = await Message.findByIdAndUpdate(
        id,
        { text },
        { returnDocument: "after", runValidators: true },
      ); // return the UPDATED doc);
      if (!message) throw new Error("Message not found");
      const data = message.toJSON();
      io.emit("message:updated", data);

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

      const message = await Message.findByIdAndDelete(id);
      if (!message) throw new Error("Message not found");

      io.emit("message:deleted", { id });
      console.log("[delete] broadcast message:deleted", id);

      return { id };
    }),
  );
}
