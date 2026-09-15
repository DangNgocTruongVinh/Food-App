-- Add a persisted storage location while preserving the value previously inferred by the UI.
CREATE TYPE "StorageLocation" AS ENUM ('REFRIGERATOR', 'FREEZER', 'DRY_STORAGE');

ALTER TABLE "PantryItem" ADD COLUMN "storageLocation" "StorageLocation";

UPDATE "PantryItem"
SET "storageLocation" = CASE
  WHEN LOWER(COALESCE("note", '')) LIKE '%đông%'
    OR LOWER("name") LIKE '%cá%'
    OR LOWER("name") LIKE '%tôm%'
    THEN 'FREEZER'::"StorageLocation"
  WHEN LOWER(COALESCE("note", '')) LIKE '%khô%'
    OR LOWER("category") LIKE '%ngũ cốc%'
    OR LOWER("category") LIKE '%gia vị%'
    THEN 'DRY_STORAGE'::"StorageLocation"
  ELSE 'REFRIGERATOR'::"StorageLocation"
END;

ALTER TABLE "PantryItem"
  ALTER COLUMN "storageLocation" SET DEFAULT 'REFRIGERATOR',
  ALTER COLUMN "storageLocation" SET NOT NULL;
