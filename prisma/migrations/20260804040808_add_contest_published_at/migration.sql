-- AlterTable
ALTER TABLE "Contest" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Contest_clientId_publishedAt_idx" ON "Contest"("clientId", "publishedAt");

-- Backfill: las convocatorias que ya salieron de DRAFT sin publishedAt (todas
-- las creadas antes de esta migración) heredan createdAt como aproximación
-- razonable del momento de publicación.
UPDATE "Contest" SET "publishedAt" = "createdAt" WHERE "status" != 'DRAFT' AND "publishedAt" IS NULL;
