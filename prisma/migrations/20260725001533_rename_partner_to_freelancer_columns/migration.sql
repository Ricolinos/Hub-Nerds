-- Rename estructural: "partner" -> "freelancer" (rol de cuenta), solo columnas/
-- constraints/índices. NO toca los valores guardados en User.role (columna
-- String libre) — eso se migra por separado en un paso posterior de datos,
-- de forma desacoplada del deploy de este cambio de esquema.
-- RENAME COLUMN/CONSTRAINT/INDEX preservan los datos y las relaciones
-- existentes (a diferencia de dropear+recrear, que Prisma habría generado
-- por defecto y hubiera perdido las filas ya pobladas).

-- Connection.partnerId -> freelancerId
ALTER TABLE "Connection" RENAME COLUMN "partnerId" TO "freelancerId";
ALTER TABLE "Connection" RENAME CONSTRAINT "Connection_partnerId_fkey" TO "Connection_freelancerId_fkey";
ALTER INDEX "Connection_partnerId_idx" RENAME TO "Connection_freelancerId_idx";
ALTER INDEX "Connection_clientId_partnerId_key" RENAME TO "Connection_clientId_freelancerId_key";

-- ContestApplication.partnerId -> freelancerId
ALTER TABLE "ContestApplication" RENAME COLUMN "partnerId" TO "freelancerId";
ALTER TABLE "ContestApplication" RENAME CONSTRAINT "ContestApplication_partnerId_fkey" TO "ContestApplication_freelancerId_fkey";
ALTER INDEX "ContestApplication_partnerId_idx" RENAME TO "ContestApplication_freelancerId_idx";
ALTER INDEX "ContestApplication_contestId_partnerId_key" RENAME TO "ContestApplication_contestId_freelancerId_key";
