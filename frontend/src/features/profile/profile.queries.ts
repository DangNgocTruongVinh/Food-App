import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/query-keys";
import { getProfile, toProfileUpdate, updateProfile, type ProfileFormValues } from "./profile.api";

export const profileQueries = {
  detail: () => queryOptions({ queryKey: queryKeys.profile, queryFn: getProfile }),
};

export const profileMutations = {
  update: (form: ProfileFormValues) => mutationOptions({
    mutationFn: () => updateProfile(toProfileUpdate(form)),
  }),
};

export function invalidateProfileQueries(queryClient: QueryClient) {
  // Preserve V1's non-blocking invalidation and its two existing targets.
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}
