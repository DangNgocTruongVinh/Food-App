import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express, { type Express } from "express";
import { errorHandler, notFound } from "../middleware/error-handler.js";

// Tests mount real HTTP routes, but mock Prisma/config before importing them.
// Never import server.ts or use the development database in this harness.
export function testApp(prefix: string, router: express.Router) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(prefix, router);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

type RequestOptions = { method?: string; body?: unknown; token?: string; form?: FormData; cookie?: string; rawBody?: string };

/** `form`: gửi multipart/form-data (upload ảnh); fetch tự đặt Content-Type kèm boundary. */
export async function request(app: Express, path: string, options: RequestOptions = {}) {
  const { status, body } = await requestWithCookies(app, path, options);
  return { status, body };
}

/** Như request, gửi kèm header Cookie (`cookie`) và trả thêm các header Set-Cookie (`setCookie`). `rawBody`: gửi nguyên văn (JSON hỏng). */
export async function requestWithCookies(app: Express, path: string, options: RequestOptions = {}) {
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: options.method ?? "GET",
      headers: {
        ...((options.body !== undefined || options.rawBody !== undefined) && !options.form ? { "Content-Type": "application/json" } : {}),
        ...(options.token ? { Authorization: options.token } : {}),
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.form ?? options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, setCookie: response.headers.getSetCookie() };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}
