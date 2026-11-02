import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../prisma/migrations/20260913000000_add_pantry_storage_location/migration.sql", import.meta.url),
  "utf8",
);

describe("Pantry storageLocation migration safety", () => {
  it("does not contain destructive table or data operations", () => {
    expect(migration).not.toMatch(/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i);
  });

  it("backfills existing rows before enforcing NOT NULL", () => {
    const addColumn = migration.indexOf('ADD COLUMN "storageLocation" "StorageLocation";');
    const backfill = migration.indexOf('UPDATE "PantryItem"');
    const notNull = migration.indexOf('ALTER COLUMN "storageLocation" SET NOT NULL');
    expect(addColumn).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(addColumn);
    expect(notNull).toBeGreaterThan(backfill);
  });

  it("maps the old UI rules and defines a safe default for new rows", () => {
    expect(migration).toContain("THEN 'FREEZER'::\"StorageLocation\"");
    expect(migration).toContain("THEN 'DRY_STORAGE'::\"StorageLocation\"");
    expect(migration).toContain("ELSE 'REFRIGERATOR'::\"StorageLocation\"");
    expect(migration).toContain('SET DEFAULT \'REFRIGERATOR\'');
  });
});

const historyMigration = readFileSync(
  new URL("../../../prisma/migrations/20261103000000_add_pantry_transactions/migration.sql", import.meta.url),
  "utf8",
);

describe("Pantry history migration safety (GĐ3b)", () => {
  it("only adds: no drop, truncate, delete or rewrite of existing rows", () => {
    expect(historyMigration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+")/i);
  });

  it("adds expiryEstimated with a default so existing pantry rows stay valid", () => {
    expect(historyMigration).toContain('ADD COLUMN     "expiryEstimated" BOOLEAN NOT NULL DEFAULT false');
  });

  it("keeps history when a pantry item, meal or shopping line is deleted, and removes it with the user", () => {
    expect(historyMigration).toMatch(/"PantryTransaction_pantryItemId_fkey".*ON DELETE SET NULL/);
    expect(historyMigration).toMatch(/"PantryTransaction_mealPlanItemId_fkey".*ON DELETE SET NULL/);
    expect(historyMigration).toMatch(/"PantryTransaction_shoppingItemId_fkey".*ON DELETE SET NULL/);
    expect(historyMigration).toMatch(/"PantryTransaction_userId_fkey".*ON DELETE CASCADE/);
  });
});
