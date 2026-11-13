// Khôi phục khi trang lỗi: lỗi tải file JS (build lại / triển khai mới làm tên file cũ biến mất) thì tự tải lại trang MỘT lần;
// lỗi khác hoặc tải lại vẫn lỗi thì hiện "Đã có lỗi, tải lại trang" (Error Boundary) thay vì trang trắng.

const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|Unable to preload CSS/i;
export const CHUNK_RELOAD_KEY = "nouri_chunk_reload_at";
/** Trong khoảng này đã tự tải lại rồi mà vẫn lỗi thì thôi (tránh tải lại vô hạn). */
export const CHUNK_RELOAD_WINDOW_MS = 10_000;

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return CHUNK_ERROR.test(message);
}

type Store = Pick<Storage, "getItem" | "setItem">;

/** Lỗi tải file JS và chưa tự tải lại trong 10 giây qua → ghi mốc thời gian, trả true (nơi gọi tải lại trang). */
export function claimChunkReload(error: unknown, storage: Store | null, now = Date.now()) {
  if (!isChunkLoadError(error)) return false;
  if (!storage) return false; // không ghi được mốc thì không tự tải lại (tránh vòng lặp)
  try {
    const last = storage.getItem(CHUNK_RELOAD_KEY);
    if (last !== null && now - Number(last) < CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false; // không ghi được mốc thì không tự tải lại (tránh vòng lặp)
  }
}

export function sessionStore(): Store | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
