import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getApiError } from "../api/client";
import { ProfileForm } from "../components/profile/ProfileForm";
import { ProfileTargetsCard } from "../components/profile/ProfileTargetsCard";
import { ErrorState, LoadingState, Skeleton, Toast } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import type { ProfileFormValues } from "../features/profile/profile.api";
import { bodyMassIndex, emptyProfileForm, isProfileDirty, toProfileForm, validateProfileForm } from "../features/profile/profile.logic";
import { invalidateProfileQueries, profileMutations, profileQueries } from "../features/profile/profile.queries";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { syncUser } = useAuth();
  const [form, setForm] = useState<ProfileFormValues>(emptyProfileForm);
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  const profile = useQuery(profileQueries.detail());
  const saved = useMemo(() => (profile.data ? toProfileForm(profile.data) : null), [profile.data]);
  useEffect(() => { if (saved) setForm(saved); }, [saved]);

  const dirty = saved ? isProfileDirty(form, saved) : false;
  const errors = submitted ? validateProfileForm(form) : {};

  // Cảnh báo khi đóng/tải lại tab mà chưa lưu (điều hướng trong ứng dụng không chặn được với router hiện tại).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    ...profileMutations.update(form),
    onSuccess: (updated) => {
      syncUser({ id: updated.id, name: updated.name, email: updated.email });
      queryClient.setQueryData(profileQueries.detail().queryKey, updated);
      invalidateProfileQueries(queryClient);
      setSaveError("");
      setSubmitted(false);
      setToast("Đã lưu hồ sơ. Chỉ tiêu dinh dưỡng đã được tính lại.");
    },
    onError: (error) => setSaveError(`Chưa lưu được hồ sơ: ${getApiError(error)}`),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setSaveError("");
    if (Object.keys(validateProfileForm(form)).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#profile-form [aria-invalid='true']")?.focus());
      return;
    }
    save.mutate();
  };
  const update = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="hs-view">
      <header className="hs-hero">
        <h1 className="ui-title">Hồ sơ <em>của bạn</em></h1>
        <p className="ui-text">Nouri dùng hồ sơ này để tính chỉ tiêu dinh dưỡng, lọc món theo chế độ ăn và dị ứng, và xếp thực đơn.</p>
      </header>
      {profile.isLoading ? (
        <LoadingState label="Đang tải hồ sơ">
          <div className="hs-layout"><Skeleton kind="block" height={640} /><Skeleton kind="block" height={320} /></div>
        </LoadingState>
      ) : profile.isError ? (
        <ErrorState message="Chưa tải được hồ sơ." onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
      ) : (
        <div className="hs-layout">
          <ProfileTargetsCard profile={profile.data?.profile} dirty={dirty} bmi={bodyMassIndex(form)} />
          <ProfileForm
            form={form}
            email={profile.data?.email}
            errors={errors}
            dirty={dirty}
            saving={save.isPending}
            saveError={saveError}
            onChange={update}
            onSubmit={submit}
          />
        </div>
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
