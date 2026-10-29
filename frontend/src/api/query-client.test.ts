import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { retryUnlessClientError } from "./query-client";

const httpError = (status: number) => new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
  status, statusText: "", data: {}, headers: {}, config: { headers: new AxiosHeaders() },
});

describe("retryUnlessClientError", () => {
  it.each([400, 401, 403, 404, 422])("never retries client error %i", (status) => {
    expect(retryUnlessClientError(0, httpError(status))).toBe(false);
  });
  it.each([
    ["server error", httpError(500)],
    ["network error", new AxiosError("offline")],
    ["unknown error", new Error("boom")],
  ])("retries a %s once, like the app default", (_label, error) => {
    expect(retryUnlessClientError(0, error)).toBe(true);
    expect(retryUnlessClientError(1, error)).toBe(false);
  });
});
