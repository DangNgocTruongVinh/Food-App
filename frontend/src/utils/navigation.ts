export type NavigationKind = "POP" | "PUSH" | "REPLACE";

const isMealPlansPath = (path: string) => path === "/meal-plans" || path.startsWith("/meal-plans/");

/**
 * Khi chuyển sang trang khác trong app thì đưa trang về đầu; nếu không, trang mới giữ vị trí cuộn của trang cũ
 * và tiêu đề nằm khuất sau thanh menu cố định. Không cuộn khi: Back/Forward của trình duyệt, chỉ đổi query
 * (vd. Pantry ?item=, Community ?post=), hoặc đổi thực đơn trong cùng trang Thực đơn.
 */
export function shouldScrollToTop(previousPath: string | null, nextPath: string, navigation: NavigationKind) {
  if (previousPath === null || previousPath === nextPath) return false;
  if (navigation === "POP") return false;
  if (isMealPlansPath(previousPath) && isMealPlansPath(nextPath)) return false;
  return true;
}
