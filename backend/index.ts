import express, { Request, Response, NextFunction } from 'express';
import messageRoutes from './routes/message.routes.js'; // new
import { connectDB } from './src/config/db';

const app = express();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('API is running');
});

app.use('/api/messages', messageRoutes); // new

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

export default app;