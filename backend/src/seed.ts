import { prisma } from "./config/db";
import { hashPassword } from "./utils/password";
import { env } from "./config/env";

async function main() {
  const email = env.seedAdminEmail.trim().toLowerCase();
  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    console.log(`Admin ${email} already exists — skipping.`);
  } else {
    const passwordHash = await hashPassword(env.seedAdminPassword);
    await prisma.admin.create({ data: { email, passwordHash } });
    console.log(`Created admin ${email} with the password from SEED_ADMIN_PASSWORD.`);
  }

  const company = await prisma.companySettings.findFirst();
  if (!company) {
    await prisma.companySettings.create({
      data: { name: env.companyName, address: env.companyAddress },
    });
    console.log(`Created default company settings for "${env.companyName}".`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
