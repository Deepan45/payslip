-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "pfEpsExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pfExcludeFromEcr" BOOLEAN NOT NULL DEFAULT false;
