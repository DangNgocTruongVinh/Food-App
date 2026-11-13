import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { COMBO_DEBOUNCE_MS, type ComboOption } from "./combobox.logic";

/**
 * Gợi ý lấy từ máy chủ cho Combobox: đợi người dùng ngừng gõ 150 ms rồi mới gọi API (mỗi câu tìm một lần, nhớ 30 giây).
 * Trả về các mục gợi ý và cờ đang tải (Combobox hiện "Đang tìm gợi ý...").
 */
export function useRemoteOptions<T>(
  key: readonly unknown[], value: string, fetcher: (query: string) => Promise<T[]>, toOption: (item: T) => ComboOption,
) {
  const [query, setQuery] = useState(value.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), COMBO_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  const result = useQuery({
    queryKey: [...key, query], queryFn: () => fetcher(query), enabled: query.length > 0, staleTime: 30_000, retry: false,
  });
  return { options: (result.data ?? []).map(toOption), loading: result.isFetching || query !== value.trim() };
}
