-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateTable
CREATE TABLE "Group" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE NOT NULL,
    "baseMonthly" DECIMAL(12,2) NOT NULL,
    "adminFeePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "passcodeHash" TEXT NOT NULL DEFAULT '',
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "monthlyTier" DECIMAL(12,2),
    "exitWeek" INTEGER,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "correctedAt" TIMESTAMP(3),
    "correctedBy" TEXT,
    "correctionReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnLock" (
    "turn" INTEGER NOT NULL,
    "memberId" TEXT NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "disbursedDate" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TurnLock_pkey" PRIMARY KEY ("turn")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "memberId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "status" "PayoutStatus" NOT NULL DEFAULT 'ACTIVE',
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "week" INTEGER NOT NULL,
    "cashHeld" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("week")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "countedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actual" DECIMAL(12,2) NOT NULL,
    "system" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "who" TEXT NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT[],
    "who" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_name_key" ON "Member"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Member_position_key" ON "Member"("position");

-- CreateIndex
CREATE INDEX "Payment_memberId_week_idx" ON "Payment"("memberId", "week");

-- CreateIndex
CREATE INDEX "Payment_recordedAt_idx" ON "Payment"("recordedAt");

-- CreateIndex
CREATE INDEX "Payout_turn_idx" ON "Payout"("turn");

-- CreateIndex
CREATE INDEX "Activity_at_idx" ON "Activity"("at");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnLock" ADD CONSTRAINT "TurnLock_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

