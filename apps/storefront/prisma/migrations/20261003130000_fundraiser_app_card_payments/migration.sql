-- Mobile fundraiser app: per-group switch for Square card payments (tap to pay, keyed, reader).
ALTER TABLE "fundraisers" ADD COLUMN "appCardPayments" BOOLEAN NOT NULL DEFAULT false;
