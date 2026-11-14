import jwt from "jsonwebtoken";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/prisma.js";
import { getAccountStatus } from "../../services/account-status.service.js";
import { allergyGroups, groupsOfFoodName, resolveRestriction } from "../../services/allergy-groups.js";
import { buildAllergyGroups, buildFoodCatalog, buildReceiptCatalog, seedCatalogRows, useSeedCatalog } from "../../services/catalog/catalog-build.js";
import { ensureCatalog, loadCatalog, seedCatalog } from "../../services/catalog/catalog.service.js";
import { expandRestrictedTerms } from "../../services/dietary.service.js";
import { foodCategoryNames, foodCategoryOf, shelfLifeFor } from "../../services/food-category.js";
import { canonicalFoodName, buildNameIndex } from "../../services/receipt/receipt-normalize.js";
import { skipRules } from "../../services/receipt/receipt-catalog.js";
import type { fakeCatalogDb } from "../../test/fake-catalog-db.js";
import { request, testApp } from "../../test/http-test-utils.js";
import catalogRoutes from "../catalog/catalog.routes.js";
import adminRoutes from "./admin.routes.js";

const secret = vi.hoisted(() => "nouri-test-only-secret-at-least-32-characters");
vi.mock("../../config/env.js", () => ({ env: { JWT_SECRET: secret } }));
vi.mock("../../lib/prisma.js", async () => ({ prisma: (await import("../../test/fake-catalog-db.js")).fakeCatalogDb() }));

const db = prisma as unknown as ReturnType<typeof fakeCatalogDb>;
const app = testApp("/api/admin", adminRoutes);
const publicApp = testApp("/api/catalog", catalogRoutes);
const adminId = "cm11111111111111111111111";
const token = `Bearer ${jwt.sign({ sub: adminId, email: "admin@nouri.vn" }, secret)}`;
const groupId = (code: string) => db.rows("allergenGroup").find((row) => row.code === code)!.id;
const admin = (method: "POST" | "PATCH", path: string, body: object) => request(app, `/api/admin/catalog/${path}`, { method, body, token });
const lastAudit = () => db.rows("adminAuditLog").at(-1)!;

beforeEach(() => {
  vi.mocked(getAccountStatus).mockResolvedValue({ role: "ADMIN", lockedAt: null });
});
afterAll(() => useSeedCatalog());

describe("Danh mục dữ liệu trong database (seed → nạp → Admin sửa → lọc dùng ngay)", () => {
  it("seed tạo đủ dữ liệu, chạy lại không tạo trùng, và danh mục đọc từ database giống hệt dữ liệu ban đầu", async () => {
    const seed = seedCatalogRows();
    expect(await seedCatalog(db as never)).toEqual({
      allergenGroups: 11, foodCategories: 8, receiptAbbreviations: seed.receiptAbbreviations.length, receiptSkipKeywords: seed.receiptSkipKeywords.length,
    });
    expect(await seedCatalog(db as never)).toEqual({ allergenGroups: 0, foodCategories: 0, receiptAbbreviations: 0, receiptSkipKeywords: 0 });
    expect(db.rows("allergenTerm").length).toBe(seed.allergenGroups.reduce((sum, group) => sum + group.terms.length, 0));
    expect(db.rows("allergenAlias").length).toBeGreaterThan(50);
    expect(db.rows("allergenGroup").filter((row) => row.parentId === groupId("SEAFOOD")).map((row) => row.code)).toEqual(["FISH", "CRUSTACEAN", "MOLLUSC"]);
    expect(db.rows("receiptSkipKeyword").some((row) => row.reason === "TAX" && row.keyword === "vat")).toBe(true);

    await ensureCatalog(db as never);
    expect(allergyGroups()).toEqual(buildAllergyGroups(seed.allergenGroups));
    const fromSeed = buildFoodCatalog(seed.foodCategories);
    expect(foodCategoryNames()).toEqual(fromSeed.categories.map((category) => category.name));
    expect(skipRules().map(([reason, rule]) => [reason, rule.source]))
      .toEqual((useSeedCatalog(), skipRules().map(([reason, rule]) => [reason, rule.source])));
    await loadCatalog(db as never);
    expect(buildReceiptCatalog(seed.receiptAbbreviations, seed.receiptSkipKeywords).abbreviations.length).toBe(db.rows("receiptAbbreviation").length);
    // Ví dụ an toàn quen thuộc vẫn đúng sau khi đi qua database.
    expect(resolveRestriction("hải sản").groups.map((group) => group.id)).toEqual(["FISH", "CRUSTACEAN", "MOLLUSC"]);
    expect(groupsOfFoodName("Sữa đậu nành").map((group) => group.id)).toEqual(["SOY"]);
    expect(groupsOfFoodName("Cháo trắng")).toEqual([]);
  });

  it("Admin thêm tên gọi khác: bộ lọc nhận ra ngay, có nhật ký; ẩn đi thì thôi nhận", async () => {
    expect(resolveRestriction("hột gà ta").groups).toEqual([]);
    const created = await admin("POST", "allergen-aliases", { groupId: groupId("EGG"), name: "hột gà ta" });
    expect(created.status).toBe(201);
    expect(resolveRestriction("hột gà ta").groups.map((group) => group.id)).toEqual(["EGG"]);
    expect(resolveRestriction("Hot ga ta", { strict: false }).groups.map((group) => group.id)).toEqual(["EGG"]);
    expect(expandRestrictedTerms(["hột gà ta"])).toContain("trứng");
    expect(lastAudit()).toMatchObject({ actorId: adminId, action: "CATALOG_CREATE", targetType: "CATALOG", targetLabel: "hột gà ta" });

    const hidden = await admin("PATCH", `allergen-aliases/${created.body.id}`, { hidden: true });
    expect(hidden.status).toBe(200);
    expect(resolveRestriction("hột gà ta").groups).toEqual([]);
    expect(lastAudit()).toMatchObject({ action: "CATALOG_UPDATE", details: { kind: "allergen-aliases", changedFields: ["hidden"] } });
  });

  it("Admin thêm nhóm và nguyên liệu (chứa / có thể chứa): nhận ra trong tên món; đổi tên nhóm vẫn giữ tên cũ", async () => {
    const group = await admin("POST", "allergen-groups", { code: "celery", label: "Cần tây" });
    expect(group.status).toBe(201);
    await admin("POST", "allergen-terms", { groupId: group.body.id, name: "cần tây" });
    await admin("POST", "allergen-terms", { groupId: group.body.id, name: "muối cần tây", level: "MAY_CONTAIN" });
    expect(groupsOfFoodName("Súp cần tây").map((item) => item.id)).toEqual(["CELERY"]);
    expect(allergyGroups().find((item) => item.id === "CELERY")).toMatchObject({ terms: ["cần tây"], mayContain: ["muối cần tây"] });

    expect((await admin("PATCH", `allergen-groups/${group.body.id}`, { label: "Rau cần" })).status).toBe(200);
    expect(resolveRestriction("Cần tây").groups.map((item) => item.label)).toEqual(["Rau cần"]);
    expect((await admin("POST", "allergen-groups", { code: "CELERY", label: "Khác" })).status).toBe(409);
    expect((await admin("PATCH", `allergen-groups/${groupId("SEAFOOD")}`, { parentId: groupId("EGG") })).status).toBe(400);
  });

  it("Admin sửa nhóm thực phẩm: hạn dùng mới áp ngay, đổi tên đổi theo trong Kho, không ẩn được nhóm mặc định", async () => {
    const vegetables = db.rows("foodCategory").find((row) => row.name === "Rau củ")!;
    expect(shelfLifeFor("Cải ngọt", "Rau củ")).toEqual({ days: 5, storage: "REFRIGERATOR" });
    db.rows("pantryItem").push({ id: "p1", category: "Rau củ" });
    await admin("PATCH", `food-categories/${vegetables.id}`, { name: "Rau & củ", defaultShelfLifeDays: 4 });
    expect(shelfLifeFor("Cải ngọt", "Rau & củ")).toEqual({ days: 4, storage: "REFRIGERATOR" });
    expect(foodCategoryOf("Cải ngọt")).toBe("Rau & củ");
    expect(db.rows("pantryItem")[0].category).toBe("Rau & củ");

    const fallback = db.rows("foodCategory").find((row) => row.isFallback)!;
    expect((await admin("PATCH", `food-categories/${fallback.id}`, { hidden: true })).status).toBe(400);
    expect((await admin("POST", "food-categories", { name: "Đồ uống", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: 7 })).status).toBe(201);
    expect(foodCategoryNames().slice(-2)).toEqual(["Đồ uống", "Khác"]);
  });

  it("Admin thêm viết tắt hóa đơn: lưu dạng bỏ dấu, đọc hóa đơn dùng ngay", async () => {
    const created = await admin("POST", "receipt-abbreviations", { abbreviation: "Nấm KM", fullName: "Nấm kim châm" });
    expect(created.status).toBe(201);
    expect(db.rows("receiptAbbreviation").at(-1)!.abbreviation).toBe("nam km");
    expect(canonicalFoodName("NAM KM", buildNameIndex([], [])).name).toBe("Nấm kim châm");
  });

  it("kiểm tra dữ liệu (Zod) và quyền Admin; API công khai trả danh mục đang dùng", async () => {
    expect((await admin("POST", "unknown-kind", { name: "x" })).status).toBe(422);
    expect((await admin("POST", "allergen-aliases", { groupId: "khong-phai-id", name: "x" })).status).toBe(422);
    expect((await admin("PATCH", `allergen-aliases/${db.rows("allergenAlias")[0].id}`, {})).status).toBe(422);
    vi.mocked(getAccountStatus).mockResolvedValue({ role: "USER", lockedAt: null });
    expect((await admin("POST", "allergen-aliases", { groupId: groupId("EGG"), name: "y" })).status).toBe(403);

    for (const [cuisine, hiddenAt] of [["Nhật Bản", null], ["Việt Nam", null], ["Việt Nam", null], ["Mỹ", new Date()]] as const) {
      db.rows("recipe").push({ id: `r${db.rows("recipe").length}`, cuisine, hiddenAt, deletedAt: null });
    }
    const response = await request(publicApp, "/api/catalog");
    expect(response.body.cuisines).toEqual(["Việt Nam", "Nhật Bản"]);
    expect(response.status).toBe(200);
    expect(response.body.allergenGroups.map((group: { id: string }) => group.id)).toContain("CELERY");
    expect(response.body.foodCategories.at(-1)).toEqual({ name: "Khác", defaultStorage: "REFRIGERATOR", defaultShelfLifeDays: null });
  });
});
