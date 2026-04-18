/*
  Warnings:

  - You are about to drop the column `resolvedAt` on the `Dispute` table. All the data in the column will be lost.
  - You are about to drop the column `closedAt` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `groupMemberId` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `approvedBy` on the `Product` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,productId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_groupMemberId_fkey";

-- DropIndex
DROP INDEX "OtpCode_userId_type_idx";

-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "resolvedAt";

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "closedAt";

-- AlterTable
ALTER TABLE "GroupMember" ALTER COLUMN "depositPaid" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "supplierAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "groupMemberId",
ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "method" SET DEFAULT 'ORANGE_MONEY';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "approvedAt",
DROP COLUMN "approvedBy",
ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Dispute_userId_idx" ON "Dispute"("userId");

-- CreateIndex
CREATE INDEX "Group_supplierId_idx" ON "Group"("supplierId");

-- CreateIndex
CREATE INDEX "GroupMember_status_idx" ON "GroupMember"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_groupId_idx" ON "Order"("groupId");

-- CreateIndex
CREATE INDEX "OtpCode_userId_type_used_idx" ON "OtpCode"("userId", "type", "used");

-- CreateIndex
CREATE INDEX "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE INDEX "Payment_transactionRef_idx" ON "Payment"("transactionRef");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
