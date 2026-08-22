import type { FilenameAliases } from '@/lib/images/sync-plan'

/**
 * Label scans whose filename does not lead to their product.
 *
 * The flat label scans in `public/images/unused/new-products/labels` were named from the jar
 * artwork, before the catalogue slugs settled. Most reach their product on the ordinary rules —
 * these are the ones where no rule connects the two, so the mapping has to be stated. A filename
 * that matches nothing is reported and skipped, never guessed at.
 */
export const LABEL_FILENAME_ALIASES: FilenameAliases = {
  // Named for the flavour; the product carries the full brand name.
  'original-mild': 'jose-madrid-original-mild',
  // The label prints the flavour alone, the product spells out the heat level.
  blueberry: 'blueberry-mild-salsa',
  // Scanned with the words in label order rather than catalogue order.
  'garden-fresh-cilantro-salsa-mild': 'garden-cilantro-mild-salsa',
  'garden-fresh-cilantro-salsa-hot': 'garden-cilantro-hot-salsa',
  // The jar is labelled "Clovis Medium"; the scan filename carries the old shelf description.
  'clovis-medium-original-chunky': 'clovis-medium-salsa',
  // Typo in the scan filename.
  craberry: 'cranberry',
}
