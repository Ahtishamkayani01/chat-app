import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { corsOptions, allowedOrigins } from "./src/config/cors";
import messageRoutes from "./routes/message.routes.js"; // new
import userRoutes from "./routes/user.routes";
import roomRoutes from "./routes/room.routes";
import authRoutes from "./routes/auth.routes";
import { connectDB } from "./src/config/db";
import { createServer } from "http";
import { Server } from "socket.io";
import { registerMessageHandlers } from "./src/socket/message.handler";
import { verifyToken } from "./src/utils/token";
import uploadRoutes from "./routes/upload.route";
import { setIO } from "./src/socket/io";
const app = express();

app.use(cors(corsOptions)); // must be before the routes
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("API is running");
});

app.use("/api/messages", messageRoutes); // new
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadRoutes);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;

// Only start a listener when running locally; Vercel imports `app` directly.
if (!process.env.VERCEL) {
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  setIO(io); // let REST controllers emit socket events
  // Runs once per connection: reject sockets without a valid token
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not logged in"));
    try {
      socket.data.username = verifyToken(token).username; // who this socket is
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // Every time a client connects, attach the message handlers to it
  io.on("connection", (socket) => {
    registerMessageHandlers(io, socket);
  });

  connectDB()
    .then(() =>
      httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log("CORS allowed origins:", allowedOrigins.join(", "));
      }),
    )
    .catch((err) => {
      console.error("Failed to start server:", err);
      process.exit(1);
    });
}

export default app;
