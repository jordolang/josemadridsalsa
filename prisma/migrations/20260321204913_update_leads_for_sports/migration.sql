/*
  Warnings:

  - You are about to drop the column `location` on the `lead_campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `searchTerm` on the `lead_campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `googleUrl` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `plusCode` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `reviewsCount` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `scrapedEmail` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `scrapedPhone` on the `leads` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `leads` table. All the data in the column will be lost.
  - Added the required column `city` to the `lead_campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `lead_campaigns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolName` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "lead_campaigns" DROP COLUMN "location",
DROP COLUMN "searchTerm",
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "schoolType" TEXT NOT NULL DEFAULT 'high school',
ADD COLUMN     "state" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "address",
DROP COLUMN "category",
DROP COLUMN "googleUrl",
DROP COLUMN "name",
DROP COLUMN "plusCode",
DROP COLUMN "rating",
DROP COLUMN "reviewsCount",
DROP COLUMN "scrapedEmail",
DROP COLUMN "scrapedPhone",
DROP COLUMN "website",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "schoolName" TEXT NOT NULL,
ADD COLUMN     "schoolUrl" TEXT,
ADD COLUMN     "sport" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "title" TEXT;
