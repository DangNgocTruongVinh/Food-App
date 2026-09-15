import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { createAppQueryClient } from "../../api/query-client";
import { queryKeys } from "../../api/query-keys";
import { getProfile, toProfileUpdate, updateProfile, type ProfileFormValues } from "./profile.api";
import { invalidateProfileQueries, profileMutations, profileQueries } from "./profile.queries";

const form: ProfileFormValues = {
  name: "  Minh Anh  ", age: "25", gender: "FEMALE", heightCm: "165", weightKg: "55.5",
  targetWeightKg: "52", activityLevel: "MODERATE", goal: "MAINTAIN", dietType: "BALANCED",
  mealsPerDay: "3", allergies: " shrimp, , milk ", dislikedFoods: "", preferredCuisines: "Vietnam, Japan",
};
const profile = { id: "user-a", name: "Minh Anh", email: "demo@nouri.vn", profile: null };
const originalAdapter = api.defaults.adapter;
let client: QueryClient;
beforeEach(() => {
  client = createAppQueryClient();
  vi.stubGlobal("localStorage", { getItem: () => null });
});
afterEach(() => { client.clear(); api.defaults.adapter = originalAdapter; vi.unstubAllGlobals(); });

describe("Profile request compatibility (no network)", () => {
  it("preserves form conversions, list trimming and the untrimmed name", () => {
    expect(toProfileUpdate(form)).toEqual({
      ...form, age: 25, heightCm: 165, weightKg: 55.5, targetWeightKg: 52, mealsPerDay: 3,
      allergies: ["shrimp", "milk"], dislikedFoods: [], preferredCuisines: ["Vietnam", "Japan"],
    });
  });
  it("sends blank measurements as null", () => {
    expect(toProfileUpdate({ ...form, age: "", heightCm: "", weightKg: "", targetWeightKg: "" }))
      .toMatchObject({ age: null, heightCm: null, weightKg: null, targetWeightKg: null });
  });
  it("preserves GET and PUT URLs, payload and response data", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: profile, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await getProfile()).toEqual(profile);
    const input = toProfileUpdate(form);
    expect(await updateProfile(input)).toEqual(profile);
    expect(adapter.mock.calls.map(([config]) => [config.method, config.url])).toEqual([["get", "/profile"], ["put", "/profile"]]);
    expect(JSON.parse(adapter.mock.calls[1][0].data)).toEqual(input);
  });
});

describe("Profile query and mutation compatibility", () => {
  it("retains V1 query keys and defaults", () => {
    expect(queryKeys.profile).toEqual(["profile"]);
    expect(queryKeys.dashboard).toEqual(["dashboard"]);
    expect(client.getDefaultOptions()).toEqual({ queries: { staleTime: 30_000, retry: 1 } });
  });
  it("shares the fresh profile cache between consumers", async () => {
    const adapter = vi.fn(async (config) => ({ config, data: profile, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    expect(await client.fetchQuery(profileQueries.detail())).toEqual(profile);
    expect(await client.fetchQuery(profileQueries.detail())).toEqual(profile);
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it("invalidates only existing profile and dashboard prefixes", () => {
    for (const key of [["profile"], ["dashboard"], ["dashboard", "detail"], ["pantry"], ["meal-plans"]]) client.setQueryData(key, {});
    expect(invalidateProfileQueries(client)).toBeUndefined();
    expect(client.getQueryState(["profile"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["dashboard"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["dashboard", "detail"])?.isInvalidated).toBe(true);
    expect(client.getQueryState(["pantry"])?.isInvalidated).toBe(false);
    expect(client.getQueryState(["meal-plans"])?.isInvalidated).toBe(false);
  });
  it("submits the form and runs invalidation after success", async () => {
    client.setQueryData(queryKeys.profile, profile);
    const adapter = vi.fn(async (config) => ({ config, data: profile, status: 200, statusText: "OK", headers: {} }));
    api.defaults.adapter = adapter;
    const mutation = new MutationObserver(client, {
      ...profileMutations.update(form), onSuccess: () => invalidateProfileQueries(client),
    });
    await mutation.mutate();
    expect(JSON.parse(adapter.mock.calls[0][0].data)).toEqual(toProfileUpdate(form));
    expect(client.getQueryState(queryKeys.profile)?.isInvalidated).toBe(true);
  });
  it("propagates a failed save without success invalidation", async () => {
    client.setQueryData(queryKeys.profile, profile);
    const failure = new Error("offline");
    api.defaults.adapter = async () => { throw failure; };
    const onSuccess = vi.fn(() => invalidateProfileQueries(client));
    const mutation = new MutationObserver(client, { ...profileMutations.update(form), onSuccess });
    await expect(mutation.mutate()).rejects.toBe(failure);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(client.getQueryState(queryKeys.profile)?.isInvalidated).toBe(false);
  });
});
