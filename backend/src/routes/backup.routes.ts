import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { streamBackup } from "../services/backup.service";

export const backupRouter = Router();
backupRouter.use(requireAuth, requirePermission("settings.manage"));

backupRouter.get("/", async (_req, res) => {
  try {
    await streamBackup(res);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: "Failed to build backup archive" });
  }
});
