-- AlterTable
ALTER TABLE "PortfolioPiece" ADD COLUMN     "collaborators" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
