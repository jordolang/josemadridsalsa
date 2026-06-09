-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'SQUARE', 'PAYPAL');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('ONLINE', 'POS');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentChannel" "PaymentChannel" DEFAULT 'ONLINE',
ADD COLUMN     "paymentProvider" "PaymentProvider" DEFAULT 'STRIPE',
ADD COLUMN     "providerPaymentId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "channel" "PaymentChannel" DEFAULT 'ONLINE',
ADD COLUMN     "methodType" TEXT,
ADD COLUMN     "paypalCaptureId" TEXT,
ADD COLUMN     "paypalOrderId" TEXT,
ADD COLUMN     "provider" "PaymentProvider" DEFAULT 'STRIPE',
ADD COLUMN     "providerPaymentId" TEXT,
ADD COLUMN     "squarePaymentId" TEXT,
ADD COLUMN     "squareTerminalCheckoutId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "provider" "PaymentProvider" DEFAULT 'STRIPE',
ADD COLUMN     "providerEventId" TEXT,
ALTER COLUMN "stripeEventId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_provider_configs" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB,
    "config" JSONB,
    "supportedMethods" TEXT[],
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_configs_provider_key" ON "payment_provider_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "payments_squarePaymentId_key" ON "payments"("squarePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_squareTerminalCheckoutId_key" ON "payments"("squareTerminalCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paypalOrderId_key" ON "payments"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paypalCaptureId_key" ON "payments"("paypalCaptureId");

-- CreateIndex
CREATE INDEX "payments_provider_idx" ON "payments"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "webhook_events_providerEventId_idx" ON "webhook_events"("providerEventId");
