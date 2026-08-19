export function unreadBadgeLabel(count: number) {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}
