-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "cycle" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Cycle" (
    "number" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("number")
);

