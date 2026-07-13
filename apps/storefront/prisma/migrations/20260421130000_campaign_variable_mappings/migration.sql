-- Per-campaign mapping of template {{variables}} → data sources.
-- Shape: { [variableName]: { source, key?, value?, fallback? } }
ALTER TABLE "email_campaigns"
  ADD COLUMN "variableMappings" JSONB;
