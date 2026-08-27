-- Drop `email_webhooks`, an outbound webhook registry that was never built.
--
-- Nothing in the codebase has ever referenced it: no route registered a webhook, nothing
-- delivered to one. It is unrelated to `app/api/webhooks/resend`, which is the *inbound*
-- handler for bounce and delivery events and stays exactly as it is.
--
-- Two guards, in order:
--   1. Idempotent — the table was created by `db push`, not by any migration, so it is absent
--      from the shadow database and from any environment built by replaying migrations. If
--      `to_regclass` returns NULL the migration is a no-op rather than erroring on a COUNT (and
--      then a DROP) against a relation that never existed.
--   2. Safe — this table carries a `secret` column, and the developer database it was checked
--      against is not the production one, so rather than trust that prod is also empty the
--      migration refuses to run if it is not. `vercel-build` wraps `prisma migrate deploy` in a
--      warning rather than a failure, so the failure mode here is "the table survives and someone
--      reads the log", which is the right way round for a destructive change that cannot be undone.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF to_regclass('"email_webhooks"') IS NULL THEN
    RAISE NOTICE 'email_webhooks already absent; nothing to drop.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO row_count FROM "email_webhooks";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'email_webhooks holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;

  DROP TABLE "email_webhooks";
END $$;
