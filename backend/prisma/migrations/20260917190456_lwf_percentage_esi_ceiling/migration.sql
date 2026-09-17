-- AlterTable
ALTER TABLE "CompanySettings" DROP COLUMN "lwfSlabWageLimit",
DROP COLUMN "lwfLowEmployeeAmt",
DROP COLUMN "lwfLowEmployerAmt",
DROP COLUMN "lwfHighEmployeeAmt",
DROP COLUMN "lwfHighEmployerAmt",
ADD COLUMN     "lwfEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
ADD COLUMN     "lwfEmployeeMaxAmt" DOUBLE PRECISION NOT NULL DEFAULT 35,
ADD COLUMN     "lwfEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
ADD COLUMN     "lwfEmployerMaxAmt" DOUBLE PRECISION NOT NULL DEFAULT 70;
