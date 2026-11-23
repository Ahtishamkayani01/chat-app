import { Request, Response } from "express";
import { uploadAttachment } from "../services/upload.service";

//POST /api/uploads/atttachment
export async function postAttachment(req: Request, res: Response) {
  if (!req.file) {
    return res
      .status(400)
      .json({ message: "No file sent (field name must be 'file')" });
  }
  try {
    const attachment = await uploadAttachment(req.file, req.user!.username);
    res.status(201).json(attachment);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
}
