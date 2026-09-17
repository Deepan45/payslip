-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "dateOfJoining" TIMESTAMP(3),
ADD COLUMN     "dateOfRelieving" TIMESTAMP(3),
ADD COLUMN     "domicileOfHaryana" BOOLEAN,
ADD COLUMN     "epfNo" TEXT,
ADD COLUMN     "isIndianNational" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passportNo" TEXT,
ADD COLUMN     "qualification" TEXT;
