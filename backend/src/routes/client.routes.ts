import { Router } from "express";
import { prisma } from "../config/db";
import { requireAuth } from "../middleware/auth";

export const clientRouter = Router();

clientRouter.get("/", requireAuth, async (_req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { employees: true, salarySheets: true } },
      columnProfile: { select: { updatedAt: true } },
    },
  });
  res.json({ clients });
});

clientRouter.post("/", requireAuth, async (req, res) => {
  const { name, address, contactPerson, contactPhone, contactEmail, billingRate } = req.body as {
    name?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    billingRate?: number;
  };
  if (!name?.trim()) return res.status(400).json({ error: "Client name is required" });

  const existing = await prisma.client.findUnique({ where: { name: name.trim() } });
  if (existing) return res.status(409).json({ error: "A client with this name already exists" });

  const client = await prisma.client.create({
    data: { name: name.trim(), address, contactPerson, contactPhone, contactEmail, billingRate },
  });
  res.status(201).json({ client });
});

clientRouter.get("/:id", requireAuth, async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: req.params.id },
    include: { columnProfile: true, _count: { select: { employees: true, salarySheets: true } } },
  });
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json({ client });
});

clientRouter.put("/:id", requireAuth, async (req, res) => {
  const { name, address, contactPerson, contactPhone, contactEmail, billingRate } = req.body as {
    name?: string;
    address?: string;
    contactPerson?: string;
    contactPhone?: string;
    contactEmail?: string;
    billingRate?: number;
  };
  if (!name?.trim()) return res.status(400).json({ error: "Client name is required" });

  try {
    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { name: name.trim(), address, contactPerson, contactPhone, contactEmail, billingRate },
    });
    res.json({ client });
  } catch {
    res.status(404).json({ error: "Client not found" });
  }
});
