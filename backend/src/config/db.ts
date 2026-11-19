import mongoose from "mongoose";

// Disable query buffering so requests fail fast with the real connection
// error instead of "buffering timed out after 10000ms".
mongoose.set("bufferCommands", false);

// Cache the connection promise so serverless invocations (Vercel) reuse
// a single connection instead of reconnecting on every request.
let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri)
      .then((m) => {
        console.log(`MongoDB connected: ${m.connection.host}`);
        return m;
      })
      .catch((err) => {
        connectionPromise = null; // allow retry on next request
        throw err;
      });
  }

  await connectionPromise;
};
