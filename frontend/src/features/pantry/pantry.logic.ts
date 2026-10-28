// Trang (bắt đầu từ 1) chứa item trong danh sách đã lọc/sắp xếp; null nếu item không có trong danh sách.
export function pantryItemPage(items: { id: string }[], itemId: string, pageSize: number) {
  const index = items.findIndex((item) => item.id === itemId);
  return index < 0 ? null : Math.floor(index / pageSize) + 1;
}
