-- CreateTable
CREATE TABLE "Deliverer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoUrl" TEXT,
    "zone" TEXT NOT NULL,
    "description" TEXT,
    "tarif" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deliverer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deliverer_phone_key" ON "Deliverer"("phone");

-- CreateIndex
CREATE INDEX "Deliverer_status_idx" ON "Deliverer"("status");

-- CreateIndex
CREATE INDEX "Deliverer_zone_idx" ON "Deliverer"("zone");
