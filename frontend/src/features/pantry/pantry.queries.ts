import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import {
  createPantryItem, deletePantryItem, listPantryItems, listPantryTransactions, toCreatePantryInput, updatePantryItem,
  type PantryFormValues, type PantryTransactionFilters,
} from "./pantry.api";

export const pantryQueries = {
  list: () => queryOptions({ queryKey: queryKeys.pantry, queryFn: listPantryItems }),
  transactions: (filters: PantryTransactionFilters) => queryOptions({
    queryKey: queryKeys.pantryTransactions(filters),
    queryFn: () => listPantryTransactions(filters),
    placeholderData: (previous) => previous,
  }),
};

export const pantryMutations = {
  create: (form: PantryFormValues) => mutationOptions({
    mutationFn: () => createPantryItem(toCreatePantryInput(form)),
  }),
  update: () => mutationOptions({
    mutationFn: ({ id, form }: { id: string; form: PantryFormValues }) => updatePantryItem(id, toCreatePantryInput(form)),
  }),
  remove: () => mutationOptions({ mutationFn: deletePantryItem }),
};

export function invalidatePantryQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.pantry });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.recipes.forYouAll });
  void queryClient.invalidateQueries({ queryKey: queryKeys.recommendations.all });
}
