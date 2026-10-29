import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

// Lỗi 4xx (không tồn tại, không thuộc quyền, id sai) có thử lại cũng không đổi kết quả.
export function retryUnlessClientError(failureCount: number, error: unknown) {
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < 1;
}

export function createAppQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
}
