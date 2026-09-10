-- CreateTable
CREATE TABLE "ClientBill" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "employeeCount" INTEGER NOT NULL,
    "totalGrossWages" DOUBLE PRECISION NOT NULL,
    "totalEmployerEpf" DOUBLE PRECISION NOT NULL,
    "totalEmployerEsi" DOUBLE PRECISION NOT NULL,
    "totalEmployerLwf" DOUBLE PRECISION NOT NULL,
    "pfAdminCharge" DOUBLE PRECISION NOT NULL,
    "billingRateUsed" DOUBLE PRECISION,
    "serviceCharge" DOUBLE PRECISION NOT NULL,
    "totalWageCost" DOUBLE PRECISION NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "lines" JSONB NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBill_sheetId_key" ON "ClientBill"("sheetId");

-- CreateIndex
CREATE INDEX "ClientBill_clientId_periodYear_periodMonth_idx" ON "ClientBill"("clientId", "periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "ClientBill" ADD CONSTRAINT "ClientBill_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "SalarySheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBill" ADD CONSTRAINT "ClientBill_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
