import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

const LOGO_DIR = path.join(__dirname, "..", "..", "storage", "logo");
fs.mkdirSync(LOGO_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: LOGO_DIR,
    filename: (_req, file, cb) => cb(null, `logo${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

export const companyRouter = Router();

companyRouter.get("/", requireAuth, async (_req, res) => {
  const company = await prisma.companySettings.findFirst();
  res.json({ company });
});

companyRouter.put("/", requireAuth, async (req, res) => {
  const { name, address, mobile, officePhone, email, website } = req.body as {
    name?: string;
    address?: string;
    mobile?: string;
    officePhone?: string;
    email?: string;
    website?: string;
  };
  if (!name) return res.status(400).json({ error: "Company name is required" });

  const data = { name, address, mobile, officePhone, email, website };
  const existing = await prisma.companySettings.findFirst();
  const company = existing
    ? await prisma.companySettings.update({ where: { id: existing.id }, data })
    : await prisma.companySettings.create({ data });

  res.json({ company });
});

companyRouter.post("/logo", requireAuth, upload.single("logo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No logo file uploaded" });

  // Store just the filename, not the full disk path — the full path (as
  // written by multer) bakes in this process's environment (e.g. a
  // container's "/app/storage/logo/..."), which breaks once read back from
  // any other environment sharing the same DB. Whoever renders the PDF
  // resolves the filename against its own local LOGO_DIR instead.
  const existing = await prisma.companySettings.findFirst();
  const company = existing
    ? await prisma.companySettings.update({ where: { id: existing.id }, data: { logoPath: req.file.filename } })
    : await prisma.companySettings.create({ data: { name: "Your Company", logoPath: req.file.filename } });

  res.json({ company });
});
