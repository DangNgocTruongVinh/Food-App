import { execSync } from "node:child_process";
import { vietnamDateKey } from "../src/utils/vietnam-date.js";

/**
 * Nguồn gốc của bảng số đánh giá: commit của mã đã chạy và ngày chạy (giờ VN), để tài liệu ghi rõ số thuộc bản mã nào.
 * Mã backend có thay đổi chưa commit thì ghi thêm để không nhầm với số của commit đó.
 */
export function evalProvenance(now = new Date()) {
  const git = (args: string) => {
    try {
      return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  };
  const commit = git("rev-parse --short HEAD") || "không rõ";
  const dirty = git("status --porcelain -- src scripts prisma") ? " (kèm thay đổi chưa commit)" : "";
  const [year, month, day] = vietnamDateKey(now).split("-");
  return `Mã ở commit \`${commit}\`${dirty}, chạy ngày ${Number(day)}/${Number(month)}/${year}.`;
}
