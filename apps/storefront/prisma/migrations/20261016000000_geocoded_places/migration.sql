-- CreateTable
CREATE TABLE "geocoded_places" (
    "query" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocoded_places_pkey" PRIMARY KEY ("query")
);
