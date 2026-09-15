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

  it("invalidates only Pantry and Dashboard query prefixes", () => {
    for (const key of [["pantry"], ["pantry", "detail"], ["dashboard"], ["profile"], ["recipes"]]) client.setQueryData(key, {});
    expect(invalidatePantryQueries(client)).toBeUndefined();
    expect(client.getQueryState(["pantry"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["pantry", "detail"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["dashboard"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["profile"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["recipes"])?.isInvalidated).toBe(false);
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
});
