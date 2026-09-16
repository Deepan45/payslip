import { Router } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../config/db";
import { AuthedRequest, requireAuth, requirePermission } from "../middleware/auth";
import { generateTempPassword, hashPassword } from "../utils/password";
import { ROLE_PERMISSIONS } from "../auth/permissions";

export const userRouter = Router();

const SELECT_SAFE = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

const VALID_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[];

userRouter.use(requireAuth, requirePermission("users.manage"));

userRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ select: SELECT_SAFE, orderBy: { createdAt: "asc" } });
  res.json({ users });
});

userRouter.post("/", async (req, res) => {
  const { name, email, role } = req.body as { name?: string; email?: string; role?: UserRole };
  const cleanEmail = email?.trim().toLowerCase();
  if (!cleanEmail) return res.status(400).json({ error: "Email is required" });
  if (!role || !VALID_ROLES.includes(role)) return res.status(400).json({ error: "A valid role is required" });

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) return res.status(409).json({ error: "A user with this email already exists" });

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const user = await prisma.user.create({
    data: { email: cleanEmail, name: name?.trim() || null, role, passwordHash, mustChangePassword: true },
    select: SELECT_SAFE,
  });

  res.status(201).json({ user, temporaryPassword });
});

// Active super admins other than the given id — used to guard the "last
// super admin" cases below so the team can never lock itself out.
async function otherActiveSuperAdminCount(excludingId: string): Promise<number> {
  return prisma.user.count({
    where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE, id: { not: excludingId } },
  });
}

userRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const { name, role, status } = req.body as { name?: string; role?: UserRole; status?: UserStatus };
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const isSelf = target.id === req.user!.id;
  if (isSelf && role && role !== target.role) {
    return res.status(400).json({ error: "You can't change your own role." });
  }
  if (isSelf && status === UserStatus.DISABLED) {
    return res.status(400).json({ error: "You can't disable your own account." });
  }

  const demotingSuperAdmin = target.role === UserRole.SUPER_ADMIN && role && role !== UserRole.SUPER_ADMIN;
  const disablingSuperAdmin = target.role === UserRole.SUPER_ADMIN && target.status === UserStatus.ACTIVE && status === UserStatus.DISABLED;
  if ((demotingSuperAdmin || disablingSuperAdmin) && (await otherActiveSuperAdminCount(target.id)) === 0) {
    return res.status(400).json({ error: "There must be at least one active Super Admin." });
  }

  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: "A valid role is required" });

  const user = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(name !== undefined ? { name: name.trim() || null } : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    },
    select: SELECT_SAFE,
  });
  res.json({ user });
});

userRouter.post("/:id/reset-password", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash, mustChangePassword: true } });

  res.json({ temporaryPassword });
});

userRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.id === req.user!.id) return res.status(400).json({ error: "You can't delete your own account." });

  if (target.role === UserRole.SUPER_ADMIN && target.status === UserStatus.ACTIVE && (await otherActiveSuperAdminCount(target.id)) === 0) {
    return res.status(400).json({ error: "There must be at least one active Super Admin." });
  }

  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});
