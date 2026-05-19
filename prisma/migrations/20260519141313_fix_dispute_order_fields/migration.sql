-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "resolution" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmedAt" TIMESTAMP(3);
