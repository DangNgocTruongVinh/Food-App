import { format } from "date-fns";

// Ngày hiển thị/nhập cố định dd/mm/yyyy; giá trị trao đổi với API giữ dạng yyyy-MM-dd.
const DISPLAY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

const pad = (value: number) => String(value).padStart(2, "0");

/** "dd/mm/yyyy" (cho phép ngày/tháng 1 chữ số) → "yyyy-MM-dd"; null nếu sai định dạng hoặc ngày không tồn tại. */
export function parseDisplayDate(text: string) {
  const match = DISPLAY_DATE.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export type DateDraftStatus = "empty" | "valid" | "invalid";

/** Phân biệt rõ ô trống (hợp lệ với trường không bắt buộc) với ô nhập sai (phải chặn lưu). */
export function resolveDateDraft(draft: string): { value: string; status: DateDraftStatus } {
  if (draft.trim() === "") return { value: "", status: "empty" };
  const iso = parseDisplayDate(draft);
  return iso ? { value: iso, status: "valid" } : { value: "", status: "invalid" };
}

/** "yyyy-MM-dd" → "dd/mm/yyyy"; chuỗi rỗng nếu không phải ngày ISO. Không qua Date nên không lệch múi giờ. */
export function isoDateToDisplay(iso: string) {
  const match = ISO_DATE.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** Tự chèn "/" khi người dùng chỉ gõ số; nếu họ tự gõ "/" thì giữ nguyên cách họ nhập. */
export function maskDateInput(raw: string) {
  if (raw.includes("/")) return raw.replace(/[^\d/]/g, "").slice(0, 10);
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export function formatDisplayDate(value: string | Date) {
  return format(new Date(value), "dd/MM/yyyy");
}

export function formatDayMonth(value: string | Date) {
  return format(new Date(value), "dd/MM");
}
