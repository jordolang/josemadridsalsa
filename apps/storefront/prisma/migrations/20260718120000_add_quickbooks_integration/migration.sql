-- CreateTable
CREATE TABLE "quickbooks_app_credentials" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "clientSecretIv" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quickbooks_connections" (
    "id" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "companyName" TEXT,
    "accessToken" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "refreshTokenIv" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "connectionError" TEXT,
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_app_credentials_environment_key" ON "quickbooks_app_credentials"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "quickbooks_connections_realmId_key" ON "quickbooks_connections"("realmId");

-- CreateIndex
CREATE INDEX "quickbooks_connections_isActive_idx" ON "quickbooks_connections"("isActive");
