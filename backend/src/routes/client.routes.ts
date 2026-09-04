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

// Tries to delete one client. Blocked if it has any uploaded salary sheets
// (real payroll history — delete those first, from History) or any
// currently assigned employees (reassign or clear them first) — same
// "don't silently destroy payroll data" stance as the advance-entry delete
// guard. Shared by both the single-delete route and the bulk one below.
async function tryDeleteClient(id: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { employees: true, salarySheets: true } } },
  });
  if (!client) return { ok: false, status: 404, error: "Client not found" };

  if (client._count.salarySheets > 0) {
    return {
      ok: false,
      status: 409,
      error: `"${client.name}" has ${client._count.salarySheets} uploaded salary sheet(s). Delete those from History first.`,
    };
  }
  if (client._count.employees > 0) {
    return {
      ok: false,
      status: 409,
      error: `"${client.name}" has ${client._count.employees} employee(s) currently assigned to it. Reassign or remove them first.`,
    };
  }

  await prisma.client.delete({ where: { id } }); // cascades its SiteColumnProfile
  return { ok: true };
}

clientRouter.delete("/:id", requireAuth, async (req, res) => {
  const result = await tryDeleteClient(req.params.id);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true });
});

// Bulk delete: attempts every id independently (one client's dependents
// don't block another's deletion) and reports per-id outcome rather than
// failing the whole batch on the first blocked one.
clientRouter.post("/delete", requireAuth, async (req, res) => {
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids must be a non-empty array" });

  const deleted: string[] = [];
  const blocked: { id: string; error: string }[] = [];
  for (const id of ids) {
    const result = await tryDeleteClient(id);
    if (result.ok) deleted.push(id);
    else blocked.push({ id, error: result.error });
  }

  res.json({ deleted, blocked });
});
