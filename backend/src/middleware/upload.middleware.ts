import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { kindOf } from "../utils/fileKind";

export const uploadSingle = multer({
  storage: multer.memoryStorage(), // keep the file in RAM; we stream it to Cloudinary
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!kindOf(file.originalname)) {
      return cb(new Error("This file type is not allowed"));
    }
    cb(null, true);
  },
}).single("file"); // the form field name the frontend must use
export function handleUpload(req: Request, res: Response, next: NextFunction) {
  uploadSingle(req, res, (err) => {
    if (!err) return next(); // file accepted, go to the controller
    const message =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 25 MB)"
        : err.message;
    res.status(400).json({ message });
  });
}
