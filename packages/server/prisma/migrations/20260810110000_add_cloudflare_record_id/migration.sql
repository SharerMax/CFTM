-- AlterTable
ALTER TABLE "DnsRecord" ADD COLUMN "cloudflareRecordId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DnsRecord_cloudflareRecordId_key" ON "DnsRecord"("cloudflareRecordId");
