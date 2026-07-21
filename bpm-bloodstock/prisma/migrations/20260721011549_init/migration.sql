-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "walletBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "heroColor" TEXT NOT NULL DEFAULT 'gold',
    "trainer" TEXT NOT NULL DEFAULT '',
    "sire" TEXT NOT NULL DEFAULT '',
    "dam" TEXT NOT NULL DEFAULT '',
    "totalShares" INTEGER NOT NULL,
    "sharePriceCents" INTEGER NOT NULL,
    "sharesSold" INTEGER NOT NULL DEFAULT 0,
    "mgmtFeeBps" INTEGER NOT NULL DEFAULT 1000,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShareHolding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShareHolding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShareHolding_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "stripeRef" TEXT,
    "relatedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offeringId" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "raceDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grossCents" INTEGER NOT NULL,
    "mgmtFeeBps" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "retainedCents" INTEGER NOT NULL DEFAULT 0,
    "distributedCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DISTRIBUTED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrizeEvent_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrizeDistribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prizeEventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrizeDistribution_prizeEventId_fkey" FOREIGN KEY ("prizeEventId") REFERENCES "PrizeEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PrizeDistribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Offering_slug_key" ON "Offering"("slug");

-- CreateIndex
CREATE INDEX "ShareHolding_offeringId_idx" ON "ShareHolding"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareHolding_userId_offeringId_key" ON "ShareHolding"("userId", "offeringId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_offeringId_idx" ON "Order"("offeringId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PrizeEvent_offeringId_idx" ON "PrizeEvent"("offeringId");

-- CreateIndex
CREATE INDEX "PrizeDistribution_userId_idx" ON "PrizeDistribution"("userId");

-- CreateIndex
CREATE INDEX "PrizeDistribution_prizeEventId_idx" ON "PrizeDistribution"("prizeEventId");
