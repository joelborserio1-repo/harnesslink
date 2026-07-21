-- Optional horse photo/poster per offering
ALTER TABLE "Offering" ADD COLUMN "imageUrl" TEXT NOT NULL DEFAULT '';
