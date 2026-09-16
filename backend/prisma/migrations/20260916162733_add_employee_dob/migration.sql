-- AlterTable
ALTER TABLE "Admin" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dob" TIMESTAMP(3);
