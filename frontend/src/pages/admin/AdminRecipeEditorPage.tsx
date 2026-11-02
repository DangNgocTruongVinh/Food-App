import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChevronLeft } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiError } from "../../api/client";
import { AdminRecipeBasics } from "../../components/admin/AdminRecipeBasics";
import { AdminRecipeImageField } from "../../components/admin/AdminRecipeImageField";
import { AdminIngredientsEditor, AdminStepsEditor } from "../../components/admin/AdminRecipeLists";
import { Button, ButtonLink, ErrorState, LoadingState, Skeleton } from "../../components/ui";
import type { AdminRecipeDetail } from "../../features/admin/admin.api";
import {
  emptyRecipeForm, hasRecipeErrors, toRecipeForm, toRecipeInput, validateRecipeForm, violationsByRow,
  type DietViolation, type RecipeFormErrors, type RecipeFormValues,
} from "../../features/admin/admin-recipes.logic";
import { adminMutations, adminQueries, invalidateAdminRecipeQueries } from "../../features/admin/admin.queries";

type LocationState = { notice?: string } | null;
const noErrors: RecipeFormErrors = { fields: {}, ingredients: {}, steps: {} };

function uploadErrorMessage(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 503) {
    return "Chưa cấu hình Cloudinary nên chưa tải ảnh lên được. Thêm biến CLOUDINARY_* ở backend rồi thử lại.";
  }
  return `Chưa tải được ảnh: ${getApiError(error)}`;
}

/** /admin/recipes/new và /admin/recipes/:id/edit: form tạo/sửa món, kiểm tra phía client giống Zod backend. */
export default function AdminRecipeEditorPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const detail = useQuery({ ...adminQueries.recipe(id ?? ""), enabled: editing });
  const [form, setForm] = useState<RecipeFormValues>(emptyRecipeForm);
  const [file, setFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState("");
  const [dietErrors, setDietErrors] = useState<Record<string, string>>({});
  const notice = (location.state as LocationState)?.notice ?? "";

  // Nạp form một lần cho mỗi món: dữ liệu tải lại (vd. sau khi tải ảnh lên) không được ghi đè phần đang sửa.
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (!detail.data || loadedId.current === detail.data.id) return;
    loadedId.current = detail.data.id;
    setForm(toRecipeForm(detail.data));
  }, [detail.data]);

  const errors = submitted ? validateRecipeForm(form) : noErrors;
  const create = useMutation(adminMutations.createRecipe());
  const update = useMutation(adminMutations.updateRecipe());
  const upload = useMutation(adminMutations.uploadImage());
  const saving = create.isPending || update.isPending || upload.isPending;

  const change = <K extends keyof RecipeFormValues>(key: K, value: RecipeFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "ingredients" || key === "dietTags") setDietErrors({});
  };

  const uploadFor = async (recipe: AdminRecipeDetail) => {
    if (!file) return recipe;
    const updated = await upload.mutateAsync({ id: recipe.id, file });
    setFile(null);
    return updated;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");
    setDietErrors({});
    if (hasRecipeErrors(validateRecipeForm(form))) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".ad-form [aria-invalid='true']")?.focus());
      return;
    }
    let saved: AdminRecipeDetail;
    try {
      saved = editing ? await update.mutateAsync({ id: id!, input: toRecipeInput(form) }) : await create.mutateAsync(toRecipeInput(form));
    } catch (error) {
      const violations = axios.isAxiosError(error) ? (error.response?.data?.details?.violations as DietViolation[] | undefined) : undefined;
      if (violations?.length) {
        setDietErrors(violationsByRow(violations, form.ingredients));
        setServerError("Nhãn Món chay/Thuần chay không khớp với nguyên liệu. Xem các dòng nguyên liệu được đánh dấu bên dưới.");
        requestAnimationFrame(() => document.querySelector<HTMLElement>(".ad-ingredient.has-diet-error input")?.focus());
      } else {
        setServerError(`Chưa lưu được món: ${getApiError(error)}`);
      }
      return;
    }
    invalidateAdminRecipeQueries(queryClient);
    try {
      await uploadFor(saved);
      invalidateAdminRecipeQueries(queryClient);
    } catch (error) {
      if (!editing) {
        navigate(`/admin/recipes/${saved.id}/edit`, { replace: true, state: { notice: `Đã tạo món “${saved.name}”. ${uploadErrorMessage(error)}` } });
      } else {
        setImageError(uploadErrorMessage(error));
      }
      return;
    }
    navigate("/admin/recipes", { state: { toast: editing ? `Đã lưu thay đổi cho “${saved.name}”.` : `Đã tạo món “${saved.name}”.` } });
  };

  const uploadNow = async () => {
    if (!detail.data) return;
    setImageError("");
    try {
      const updated = await uploadFor(detail.data);
      setForm((current) => ({ ...current, imageUrl: updated.imageUrl }));
      invalidateAdminRecipeQueries(queryClient);
    } catch (error) {
      setImageError(uploadErrorMessage(error));
    }
  };

  const title = editing ? `Sửa “${detail.data?.name ?? "..."}”` : "Tạo món mới";
  const back = <Link className="ad-back" to="/admin/recipes"><ChevronLeft aria-hidden="true" />Danh sách công thức</Link>;

  if (editing && detail.isLoading) {
    return <section className="ad-section">{back}<LoadingState label="Đang tải món"><Skeleton kind="block" height={480} /></LoadingState></section>;
  }
  if (editing && (detail.isError || !detail.data)) {
    const notFound = axios.isAxiosError(detail.error) && detail.error.response?.status === 404;
    return (
      <section className="ad-section">
        {back}
        <ErrorState
          message={notFound ? "Không tìm thấy món này. Có thể món đã bị xóa." : "Chưa tải được món."}
          onRetry={notFound ? undefined : () => void detail.refetch()}
        />
      </section>
    );
  }

  return (
    <section className="ad-section" aria-labelledby="ad-editor-title">
      {back}
      <div className="ad-section__head">
        <h2 id="ad-editor-title" className="ad-section__title">{title}</h2>
        {detail.data?.hidden && <span className="ad-status ad-status--hidden">Đã ẩn</span>}
      </div>
      {notice && <p className="ui-notice" role="status">{notice}</p>}
      <form className="ad-form" noValidate onSubmit={(event) => void submit(event)}>
        <AdminRecipeBasics form={form} errors={errors.fields} onChange={change} />
        <AdminIngredientsEditor
          rows={form.ingredients}
          errors={errors.ingredients}
          dietErrors={dietErrors}
          listError={errors.fields.ingredients}
          onChange={(rows) => change("ingredients", rows)}
        />
        <AdminStepsEditor rows={form.steps} errors={errors.steps} listError={errors.fields.steps} onChange={(rows) => change("steps", rows)} />
        <AdminRecipeImageField
          name={form.name}
          imageUrl={form.imageUrl}
          file={file}
          error={imageError}
          uploading={upload.isPending}
          canUploadNow={editing}
          onSelect={(picked, problem) => { setFile(picked); setImageError(problem); }}
          onUpload={() => void uploadNow()}
          onRemoveImage={() => change("imageUrl", null)}
        />
        <div className="ad-form__actions">
          {serverError && <ErrorState message={serverError} />}
          <div className="ad-form__buttons">
            <ButtonLink to="/admin/recipes">Hủy</ButtonLink>
            <Button type="submit" variant="primary" busy={saving}>{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo món"}</Button>
          </div>
        </div>
      </form>
    </section>
  );
}
