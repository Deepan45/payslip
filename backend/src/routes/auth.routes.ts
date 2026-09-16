import { Router } from "express";
import { UserStatus } from "@prisma/client";
import { prisma } from "../config/db";
import { hashPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { permissionsForRole } from "../auth/permissions";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.status === UserStatus.DISABLED) {
    return res.status(403).json({ error: "This account has been disabled" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({ role: "admin", adminId: user.id, email: user.email });
  res.json({
    token,
    admin: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissionsForRole(user.role),
      mustChangePassword: user.mustChangePassword,
    },
  });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ admin: req.user });
});

authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });

  res.json({ ok: true });
});
