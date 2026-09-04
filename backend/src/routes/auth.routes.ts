import { Router } from "express";
import { prisma } from "../config/db";
import { verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const admin = await prisma.admin.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!admin) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ role: "admin", adminId: admin.id, email: admin.email });
  res.json({ token, admin: { id: admin.id, email: admin.email } });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ admin: req.admin });
});
