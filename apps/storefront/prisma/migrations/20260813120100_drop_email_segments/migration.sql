-- Drop `email_segments`, a marketing-segmentation model with nothing behind it.
--
-- The table described audience conditions (`conditions` JSON, `subscriberCount`,
-- `lastCalculatedAt`) but no code ever read or wrote it: no segment was ever calculated, and no
-- campaign was ever targeted by one. Real customer segmentation is a dedicated feature and will
-- be designed as one; until then this is a plan wearing a table's clothes, exactly the shape the
-- admin-platform audit warned about.
--
-- Two guards, in order: idempotent if the table is already gone (`to_regclass` returns NULL, so
-- the COUNT never runs against a missing relation), then refuse if it exists and still holds
-- rows, so a non-empty production table is exported first rather than silently deleted.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  IF to_regclass('"email_segments"') IS NULL THEN
    RAISE NOTICE 'email_segments already absent; nothing to drop.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO row_count FROM "email_segments";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'email_segments holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;

  DROP TABLE "email_segments";
END $$;
