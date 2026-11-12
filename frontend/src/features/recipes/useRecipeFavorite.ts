import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { setRecipeFavorite } from "./recipes.api";

/** Bật/tắt yêu thích (UC24); xong thì làm mới danh sách món, chi tiết, "Món yêu thích" và gợi ý (yêu thích là tín hiệu "thích"). */
export function useRecipeFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setRecipeFavorite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all });
    },
  });
}
