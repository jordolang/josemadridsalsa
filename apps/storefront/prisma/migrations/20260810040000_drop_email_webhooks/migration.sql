-- Drop `email_webhooks`, an outbound webhook registry that was never built.
--
-- Nothing in the codebase has ever referenced it: no route registered a webhook, nothing
-- delivered to one. It is unrelated to `app/api/webhooks/resend`, which is the *inbound*
-- handler for bounce and delivery events and stays exactly as it is.
--
-- The guard is the point. This table carries a `secret` column, and the developer database it
-- was checked against is not the production one — so rather than trust that prod is also empty,
-- the migration refuses to run if it is not. `vercel-build` wraps `prisma migrate deploy` in a
-- warning rather than a failure, so the failure mode here is "the table survives and someone
-- reads the log", which is the right way round for a destructive change that cannot be undone.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM "email_webhooks";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'email_webhooks holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;
END $$;

DROP TABLE "email_webhooks";
