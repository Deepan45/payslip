import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { uploadSalarySheet, downloadSalarySheetTemplate, analyzeSalarySheet } from "../controllers/upload.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const okExt = /\.(xlsx|xls)$/i.test(file.originalname);
    const okMime = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ].includes(file.mimetype);
    if (okExt || okMime) return cb(null, true);
    cb(new Error("Only .xlsx or .xls files are allowed"));
  },
});

export const uploadRouter = Router();

uploadRouter.get("/template", requireAuth, downloadSalarySheetTemplate);
uploadRouter.post("/analyze", requireAuth, upload.single("file"), analyzeSalarySheet);
uploadRouter.post("/", requireAuth, upload.single("file"), uploadSalarySheet);
