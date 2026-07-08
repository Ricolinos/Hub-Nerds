-- AlterTable
ALTER TABLE "PortfolioPiece" ADD COLUMN     "downloadUrl" TEXT,
ADD COLUMN     "markdownContent" TEXT,
ADD COLUMN     "resourcePassword" TEXT,
ALTER COLUMN "category" SET DEFAULT 'Documento',
ALTER COLUMN "coverUrl" DROP NOT NULL;
