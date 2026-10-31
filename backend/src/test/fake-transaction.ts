import type { Mock } from "vitest";

/**
 * Giả lập prisma.$transaction cho test: mảng → Promise.all; hàm → chạy với một bản bọc của client giả (giống `tx`).
 * Chỉ lời gọi qua `tx` mới tính là trong transaction; gọi thẳng `prisma.*` bên trong callback thì không.
 * Dùng `wasCalledInTransaction` để kiểm tra một lệnh ghi (vd. nhật ký Admin) thuộc cùng transaction.
 */
export function fakeTransaction(client: () => object) {
  const callsInside = new WeakSet<object>();

  const transactionClient = () => new Proxy(client(), {
    get: (target, model) => new Proxy(Reflect.get(target, model) as object, {
      get: (delegate, method) => {
        const fn = Reflect.get(delegate, method);
        if (typeof fn !== "function") return fn;
        return (...args: unknown[]) => {
          const result = fn(...args);
          if (result && typeof result === "object") callsInside.add(result);
          return result;
        };
      },
    }),
  });

  const run = async (operation: unknown) => {
    if (Array.isArray(operation)) return Promise.all(operation);
    if (typeof operation !== "function") throw new Error("Unexpected transaction input");
    return operation(transactionClient());
  };

  /** Lời gọi thứ `index` của `write`: hoặc nằm trong mảng của $transaction, hoặc gọi qua `tx` của transaction dạng hàm. */
  const wasCalledInTransaction = (transaction: Mock, write: Mock, index = 0) => {
    const result = write.mock.results[index]?.value as object | undefined;
    if (!result) return false;
    return callsInside.has(result) || transaction.mock.calls.some(([operation]) => Array.isArray(operation) && operation.includes(result));
  };

  return { run, wasCalledInTransaction };
}
