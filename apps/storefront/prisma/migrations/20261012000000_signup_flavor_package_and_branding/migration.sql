-- AlterTable
ALTER TABLE "fundraiser_signup_requests" ADD COLUMN     "flavorPackage" TEXT,
ADD COLUMN     "teamColor" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "coverPhotoUrl" TEXT,
ADD COLUMN     "missionStatement" TEXT,
ADD COLUMN     "bio" TEXT;

-- AlterTable
ALTER TABLE "fundraisers" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "flavorPackage" TEXT;
