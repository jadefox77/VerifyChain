-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageId" TEXT;

-- CreateTable
CREATE TABLE "BrandProfile" (
    "manufacturerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "tagline" TEXT,
    "logoImageId" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#078f5a',
    "secondaryColor" TEXT NOT NULL DEFAULT '#0b4a34',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f9fafb',
    "fontStyle" TEXT NOT NULL DEFAULT 'sans',
    "websiteUrl" TEXT,
    "supportUrl" TEXT,
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "xUrl" TEXT,
    "tiktokUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("manufacturerId")
);

-- CreateTable
CREATE TABLE "BrandImage" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_logoImageId_key" ON "BrandProfile"("logoImageId");

-- CreateIndex
CREATE INDEX "BrandImage_manufacturerId_idx" ON "BrandImage"("manufacturerId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "BrandImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_logoImageId_fkey" FOREIGN KEY ("logoImageId") REFERENCES "BrandImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandImage" ADD CONSTRAINT "BrandImage_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

