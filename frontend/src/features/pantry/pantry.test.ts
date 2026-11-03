import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import type { PantryInput, PantryItem } from "../../types";
import {
  createPantryItem, deletePantryItem, listPantryItems, toCreatePantryInput, toPantryFormValues, updatePantryItem,
  type PantryFormValues,
} from "./pantry.api";
import { invalidatePantryQueries, pantryMutations, pantryQueries } from "./pantry.queries";
import {
  activeStatFilter, applyStatFilter, expiryCopy, filterAndSortPantry, formatPantryQuantity, getDaysLeft, getPantryStatus,
  initialPantryForm, isBelowMinimum, isExpiryEstimated, itemsToUseSoon, pantryCategories, pantryCategoryOptions, pantryCounts, pantryDoneMessage,
  pantryItemPage, pantryStatusLabel, stockWarning, validatePantryForm, type PantryFilters,
} from "./pantry.logic";

const form: PantryFormValues = {
  name: "Ức gà", category: "Thịt & cá", quantity: 500, unit: "G",
  storageLocation: "FREEZER", expiryDate: "2026-09-20", minimumStock: 100, note: "Ngăn đông",
};
const input: PantryInput = { ...form };
const item: PantryItem = {
  id: "item-a", name: form.name, category: form.category, quantity: form.quantity,
  unit: form.unit, storageLocation: form.storageLocation,
  expiryDate: `${form.expiryDate}T00:00:00.000Z`, minimumStock: form.minimumStock, note: form.note,
};
const originalAdapter = api.defaults.adapter;
let client: QueryClient;

beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("sessionStorage", { getItem: () => null });
});
afterEach(() => {
  client.clear();
  api.defaults.adapter = originalAdapter;
  vi.unstubAllGlobals();
});

describe("Pantry API adapters (no network)", () => {
  it("preserves the add form payload and converts an empty expiry date to null", () => {
    expect(toCreatePantryInput(form)).toEqual(form);
    expect(toCreatePantryInput({ ...form, expiryDate: "" })).toEqual({ ...form, expiryDate: null });
  });

  it("maps persisted values into the edit form, including stock and storage", () => {
    expect(toPantryFormValues(item)).toEqual(form);
    expect(toPantryFormValues({ ...item, expiryDate: null, note: null })).toEqual({ ...form, expiryDate: "", note: "" });
  });

  it("lists Pantry items and unwraps the existing response", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: [item], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await listPantryItems()).toEqual([item]);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "get", url: "/pantry" });
  });

  it("creates a Pantry item with the same URL and payload", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: item, status: 201, statusText: "Created", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await createPantryItem(input)).toEqual(item);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "post", url: "/pantry" });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual(input);
  });

  it("updates a Pantry item with the same URL and partial payload", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: item, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await updatePantryItem(item.id, { quantity: 250 })).toEqual(item);
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "put", url: `/pantry/${item.id}` });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual({ quantity: 250 });
  });

  it("deletes a Pantry item with the same URL", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: undefined, status: 204, statusText: "No Content", headers: {} }));
    api.defaults.adapter = adapter;
    await expect(deletePantryItem(item.id)).resolves.toBeUndefined();
    expect(adapter.mock.calls[0][0]).toMatchObject({ method: "delete", url: `/pantry/${item.id}` });
  });

  it.each(["create", "update", "delete"] as const)("propagates a failed %s request for the page error handler", async (operation) => {
    const failure = new Error(`${operation} failed`);
    api.defaults.adapter = async () => { throw failure; };
    const request = operation === "create"
      ? createPantryItem(input)
      : operation === "update"
        ? updatePantryItem(item.id, { minimumStock: 150, storageLocation: "DRY_STORAGE" })
        : deletePantryItem(item.id);
    await expect(request).rejects.toBe(failure);
  });
});

describe("Pantry query and mutation definitions", () => {
  it("uses the shared Pantry query key and fresh cache", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: [item], status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(queryKeys.pantry).toEqual(["pantry"]);
    expect(await client.fetchQuery(pantryQueries.list())).toEqual([item]);
    expect(await client.fetchQuery(pantryQueries.list())).toEqual([item]);
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("invalidates Pantry, Dashboard and recipe \"Dành cho bạn\" queries only", () => {
    for (const key of [["pantry"], ["pantry", "detail"], ["dashboard"], ["profile"], ["recipes"], ["recipes", "for-you", "recipe-a"]]) {
      client.setQueryData(key, {});
    }
    expect(invalidatePantryQueries(client)).toBeUndefined();
    expect(client.getQueryState(["pantry"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["pantry", "detail"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["dashboard"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["profile"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["recipes"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["recipes", "for-you", "recipe-a"])?.isInvalidated).toBe(true);
  });

  it("executes create, update and delete mutations through the shared API", async () => {
    const adapter = vi.fn(async (config) => ({
      config, data: config.method === "delete" ? undefined : item,
      status: config.method === "post" ? 201 : config.method === "delete" ? 204 : 200,
      statusText: "OK", headers: {},
    }));
    api.defaults.adapter = adapter;
    await new MutationObserver(client, pantryMutations.create(form)).mutate();
    await new MutationObserver(client, pantryMutations.update()).mutate({
      id: item.id, form: { ...form, minimumStock: 150, storageLocation: "DRY_STORAGE" },
    });
    await new MutationObserver(client, pantryMutations.remove()).mutate(item.id);
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([
      ["post", "/pantry"], ["put", `/pantry/${item.id}`], ["delete", `/pantry/${item.id}`],
    ]);
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toMatchObject({ minimumStock: 150, storageLocation: "DRY_STORAGE" });
  });

  it("clears an existing expiry date when the edit form's date is left empty", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: item, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    const editForm = toPantryFormValues(item);
    expect(editForm.expiryDate).toBe(form.expiryDate);
    await new MutationObserver(client, pantryMutations.update()).mutate({ id: item.id, form: { ...editForm, expiryDate: "" } });
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toMatchObject({ expiryDate: null });
  });

  it("creates an item without an expiry date when the date is left empty", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: item, status: 201, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    await new MutationObserver(client, pantryMutations.create({ ...form, expiryDate: "" })).mutate();
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toMatchObject({ expiryDate: null });
  });
});

describe("Pantry notification focus", () => {
  const items = Array.from({ length: 17 }, (_, index) => ({ id: `item-${index}` }));
  it.each([["item-0", 1], ["item-7", 1], ["item-8", 2], ["item-16", 3]] as const)("finds %s on page %i", (id, page) => {
    expect(pantryItemPage(items, id, 8)).toBe(page);
  });
  it("returns null for an item that is not in the list", () => {
    expect(pantryItemPage(items, "deleted-item", 8)).toBeNull();
    expect(pantryItemPage([], "item-0", 8)).toBeNull();
  });
});


describe("Pantry page logic", () => {
  // Mốc cố định: 30/10/2026 12:00 giờ máy.
  const now = new Date(2026, 9, 30, 12, 0);
  const pantryItem = (overrides: Partial<PantryItem>): PantryItem => ({ ...item, id: overrides.name ?? item.id, minimumStock: 0, ...overrides });
  const items = [
    pantryItem({ name: "Sữa tươi", category: "Trứng & sữa", quantity: 1, storageLocation: "REFRIGERATOR", expiryDate: "2026-10-25T00:00:00.000Z" }),
    pantryItem({ name: "Chuối", category: "Trái cây", quantity: 6, storageLocation: "DRY_STORAGE", expiryDate: "2026-10-31T00:00:00.000Z" }),
    pantryItem({ name: "Cà chua", category: "Rau củ", quantity: 500, storageLocation: "REFRIGERATOR", expiryDate: "2026-11-02T00:00:00.000Z" }),
    pantryItem({ name: "Bông cải xanh", category: "Rau củ", quantity: 300, storageLocation: "FREEZER", expiryDate: "2026-12-20T00:00:00.000Z" }),
    pantryItem({ name: "Nước mắm", category: "Gia vị", quantity: 1, minimumStock: 1, storageLocation: "DRY_STORAGE", expiryDate: null }),
    pantryItem({ name: "Gạo", category: "Ngũ cốc", quantity: 0.5, unit: "KG", minimumStock: 1, storageLocation: "DRY_STORAGE", expiryDate: null }),
  ];
  const noFilters: PantryFilters = { search: "", status: "all", category: "all", storage: "all", sortBy: "expiry", lowStock: false };

  it("classifies expiry with the same 3-day window as the backend alerts", () => {
    expect(items.map((value) => getPantryStatus(value, now))).toEqual(["expired", "expiring", "expiring", "good", "good", "good"]);
    expect(getDaysLeft(items[1], now)).toBe(1);
    expect(getDaysLeft(items[4], now)).toBeNull();
    expect(pantryStatusLabel("expiring")).toBe("Sắp hết hạn");
  });

  it("describes the expiry date as \"còn N ngày\"", () => {
    expect(expiryCopy(items[0], now)).toEqual({ date: "25/10/2026", relative: "Quá hạn 5 ngày" });
    expect(expiryCopy(pantryItem({ expiryDate: "2026-10-30T00:00:00.000Z" }), now).relative).toBe("Hết hạn hôm nay");
    expect(expiryCopy(items[1], now).relative).toBe("Còn 1 ngày");
    expect(expiryCopy(items[4], now)).toEqual({ date: "Không có hạn", relative: "" });
  });

  it("marks only a suggested expiry that is still set as \"Hạn ước tính\"", () => {
    expect(isExpiryEstimated(pantryItem({ expiryEstimated: true, expiryDate: "2026-11-06T00:00:00.000Z" }))).toBe(true);
    expect(isExpiryEstimated(pantryItem({ expiryEstimated: false, expiryDate: "2026-11-06T00:00:00.000Z" }))).toBe(false);
    expect(isExpiryEstimated(pantryItem({ expiryEstimated: true, expiryDate: null }))).toBe(false);
    expect(isExpiryEstimated(pantryItem({ expiryDate: "2026-11-06T00:00:00.000Z" }))).toBe(false);
  });

  it("flags stock at or below the minimum, like the backend low-stock notification", () => {
    expect(items.map(isBelowMinimum)).toEqual([false, false, false, false, true, true]);
    expect(isBelowMinimum({ quantity: 0, minimumStock: 0 })).toBe(false);
    expect(stockWarning(items[5])).toBe("Dưới mức tối thiểu 1 kg");
    expect(stockWarning(items[4])).toBe("Chạm mức tối thiểu 1 g");
    expect(stockWarning(items[2])).toBeNull();
    expect(formatPantryQuantity(0.5, "KG")).toBe("0,5 kg");
    expect(formatPantryQuantity(1500, "G")).toBe("1.500 g");
  });

  it("counts the summary metrics and categories (most items first)", () => {
    expect(pantryCounts(items, now)).toEqual({ total: 6, depleted: 0, good: 3, expiring: 2, expired: 1, lowStock: 2 });
    expect(pantryCategories(items)[0]).toEqual(["Rau củ", 2]);
  });

  it("filters by search, status, category, storage and low stock, then sorts", () => {
    const names = (filters: Partial<PantryFilters>) => filterAndSortPantry(items, { ...noFilters, ...filters }, now).map((value) => value.name);
    expect(names({})).toEqual(["Sữa tươi", "Chuối", "Cà chua", "Bông cải xanh", "Nước mắm", "Gạo"]);
    expect(names({ search: "  RAU " })).toEqual(["Cà chua", "Bông cải xanh"]);
    expect(names({ status: "expiring" })).toEqual(["Chuối", "Cà chua"]);
    expect(names({ category: "Gia vị" })).toEqual(["Nước mắm"]);
    expect(names({ storage: "DRY_STORAGE" })).toEqual(["Chuối", "Nước mắm", "Gạo"]);
    expect(names({ lowStock: true })).toEqual(["Nước mắm", "Gạo"]);
    expect(names({ sortBy: "name" })).toEqual(["Bông cải xanh", "Cà chua", "Chuối", "Gạo", "Nước mắm", "Sữa tươi"]);
    expect(names({ sortBy: "quantity" })[0]).toBe("Cà chua");
  });

  it("maps the four stat tiles to filters and toggles back to all", () => {
    expect(activeStatFilter({ status: "all", lowStock: false })).toBe("all");
    expect(activeStatFilter({ status: "expired", lowStock: false })).toBe("expired");
    expect(activeStatFilter({ status: "good", lowStock: false })).toBeNull();
    expect(activeStatFilter({ status: "all", lowStock: true })).toBe("lowStock");
    expect(activeStatFilter({ status: "expiring", lowStock: true })).toBeNull();
    expect(applyStatFilter("expiring", { status: "all", lowStock: false })).toEqual({ status: "expiring", lowStock: false });
    expect(applyStatFilter("lowStock", { status: "expiring", lowStock: false })).toEqual({ status: "all", lowStock: true });
    expect(applyStatFilter("lowStock", { status: "all", lowStock: true })).toEqual({ status: "all", lowStock: false });
    expect(applyStatFilter("all", { status: "good", lowStock: true })).toEqual({ status: "all", lowStock: false });
  });

  it("lists items to use soon, nearest expiry first", () => {
    const soon = itemsToUseSoon([...items].reverse(), now);
    expect(soon.expiring.map((value) => value.name)).toEqual(["Chuối", "Cà chua"]);
    expect(soon.expired.map((value) => value.name)).toEqual(["Sữa tươi"]);
  });

  it("validates each form field with a message that says how to fix it", () => {
    expect(validatePantryForm(initialPantryForm, false)).toEqual({ name: "Nhập tên thực phẩm, ví dụ: Ức gà." });
    expect(validatePantryForm(form, false)).toEqual({});
    expect(validatePantryForm({ ...form, expiryDate: "" }, false)).toEqual({});
    const errors = validatePantryForm({ ...form, name: "  ", quantity: 0, minimumStock: -1, note: "x".repeat(301) }, true);
    expect(Object.keys(errors).sort()).toEqual(["expiryDate", "minimumStock", "name", "note", "quantity"]);
    expect(errors.expiryDate).toContain("dd/mm/yyyy");
    expect(errors.quantity).toBe("Nhập số lượng lớn hơn 0.");
  });

  it("keeps the default form, category options and done messages", () => {
    expect(initialPantryForm).toMatchObject({ category: "Rau củ", quantity: 1, unit: "ITEM", storageLocation: "REFRIGERATOR", expiryDate: "" });
    expect(pantryCategoryOptions("Rau củ")).toEqual(["Rau củ", "Thịt & cá", "Trứng & sữa", "Đậu & hạt", "Ngũ cốc", "Trái cây", "Gia vị", "Khác"]);
    expect(pantryCategoryOptions("Đồ hộp")[0]).toBe("Đồ hộp");
    expect(pantryDoneMessage("create", "Ức gà")).toBe("Đã lưu “Ức gà” vào kho.");
    expect(pantryDoneMessage("update", "Ức gà")).toBe("Đã lưu thay đổi cho “Ức gà”.");
    expect(pantryDoneMessage("delete", "Ức gà")).toBe("Đã xóa “Ức gà” khỏi kho.");
  });
});

describe("Depleted pantry items (quantity 0, GĐ3b decision 1)", () => {
  const base = { category: "Ngũ cốc", unit: "G" as const, storageLocation: "DRY_STORAGE" as const, minimumStock: 0, note: null };
  const items = [
    { ...base, id: "a", name: "Gạo", quantity: 0, expiryDate: "2026-11-04T00:00:00.000Z" },
    { ...base, id: "b", name: "Bún", quantity: 300, expiryDate: "2026-11-05T00:00:00.000Z" },
    { ...base, id: "c", name: "Đậu xanh", quantity: 0, expiryDate: null, minimumStock: 200 },
    { ...base, id: "d", name: "Yến mạch", quantity: 500, expiryDate: "2026-11-02T00:00:00.000Z" },
  ];
  const day = new Date("2026-11-03T08:00:00.000Z");

  it("labels quantity 0 as \"Đã dùng hết\", before any expiry status", () => {
    expect(items.map((item) => getPantryStatus(item, day))).toEqual(["depleted", "expiring", "depleted", "expired"]);
    expect(pantryStatusLabel("depleted")).toBe("Đã dùng hết");
  });

  it("does not count depleted items in \"Tất cả\" or expiry stats, but still counts them as under minimum stock", () => {
    expect(pantryCounts(items, day)).toEqual({ total: 2, depleted: 2, good: 0, expiring: 1, expired: 1, lowStock: 1 });
  });

  it("filters \"Đã dùng hết\" (no stat cell) and lists depleted items last", () => {
    const filters = { search: "", status: "all" as const, category: "all", storage: "all" as const, sortBy: "expiry", lowStock: false };
    expect(filterAndSortPantry(items, filters, day).map((item) => item.id)).toEqual(["d", "b", "a", "c"]);
    expect(filterAndSortPantry(items, { ...filters, sortBy: "name" }, day).map((item) => item.id)).toEqual(["b", "d", "c", "a"]);
    expect(filterAndSortPantry(items, { ...filters, status: "depleted" }, day).map((item) => item.id)).toEqual(["a", "c"]);
    expect(activeStatFilter({ status: "depleted", lowStock: false })).toBeNull();
  });

  it("keeps depleted items out of \"Cần dùng sớm\"", () => {
    const soon = itemsToUseSoon(items, day);
    expect([...soon.expiring, ...soon.expired].map((item) => item.id)).toEqual(["b", "d"]);
  });
});
