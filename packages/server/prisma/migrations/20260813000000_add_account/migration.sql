-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cloudflareAccountId" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "cloudflareTokenId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_cloudflareAccountId_key" ON "Account"("cloudflareAccountId");
