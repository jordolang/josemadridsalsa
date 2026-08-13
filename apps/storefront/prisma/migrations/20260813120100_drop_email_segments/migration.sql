-- Drop `email_segments`, a marketing-segmentation model with nothing behind it.
--
-- The table described audience conditions (`conditions` JSON, `subscriberCount`,
-- `lastCalculatedAt`) but no code ever read or wrote it: no segment was ever calculated, and no
-- campaign was ever targeted by one. Real customer segmentation is a dedicated feature and will
-- be designed as one; until then this is a plan wearing a table's clothes, exactly the shape the
-- admin-platform audit warned about.
--
-- Guarded like the other destructive drops: refuse to run if any rows exist, so a non-empty
-- production table survives and is noticed rather than silently deleted.

DO $$
DECLARE
  row_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM "email_segments";

  IF row_count > 0 THEN
    RAISE EXCEPTION
      'email_segments holds % row(s); refusing to drop. Export them first, then re-run.',
      row_count;
  END IF;
END $$;

DROP TABLE "email_segments";
