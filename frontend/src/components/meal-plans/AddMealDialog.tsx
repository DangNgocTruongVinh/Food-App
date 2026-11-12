import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { addableRecipes } from "../../features/meal-plans/add-meal.logic";
import { recipeDietLabel } from "../../features/recipes/recipes.logic";
import { recipeQueries } from "../../features/recipes/recipes.queries";
import type { MealType } from "../../types";
import { Button, Dialog, EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";
import { MealSlotFields } from "./MealSlotFields";

type AddMealDialogProps = {
  /** Bữa chọn sẵn (bữa đầu tiên còn trống của ngày); người dùng đổi được, kể cả bữa phụ. */
  initialMealType: MealType;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: { recipeId: string; mealType: MealType; servings: number }) => void;
};

/** Hộp chọn công thức có sẵn cho một ngày; danh sách đã kèm fit do backend tính theo hồ sơ hiện tại. */
export function AddMealDialog({ initialMealType, busy, error, onClose, onSubmit }: AddMealDialogProps) {
  const recipesQuery = useQuery(recipeQueries.list());
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState(initialMealType);
  const [selectedId, setSelectedId] = useState("");
  const [servings, setServings] = useState("1");
  const recipes = useMemo(() => addableRecipes(recipesQuery.data ?? [], mealType, search), [mealType, recipesQuery.data, search]);
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const save = () => {
    const value = Number(servings);
    if (selected && Number.isFinite(value) && value > 0) onSubmit({ recipeId: selected.id, mealType, servings: value });
  };
  const emptyMessage = search ? "Không tìm thấy món phù hợp cho bữa này. Thử từ ngắn hơn hoặc tên nguyên liệu." : "Chưa có công thức phù hợp cho bữa này.";

  return (
    <Dialog
      title="Thêm món vào ngày"
      description="Chọn một công thức có sẵn. Món không hợp dị ứng hoặc chế độ ăn đã được loại khỏi danh sách."
      onClose={onClose}
      className="td-add-meal"
    >
      <MealSlotFields
        idPrefix="td-add-meal"
        mealType={mealType}
        servings={servings}
        disabled={busy}
        onMealTypeChange={setMealType}
        onServingsChange={setServings}
      />
      <label className="td-add-meal__search" htmlFor="td-add-meal-search">
        <span>Tìm công thức</span>
        <span className="td-add-meal__search-input">
          <Search aria-hidden="true" />
          <input id="td-add-meal-search" className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
        </span>
      </label>
      {recipesQuery.isLoading ? (
        <LoadingState label="Đang tải công thức">
          {[0, 1, 2].map((item) => <Skeleton key={item} kind="block" height={64} />)}
        </LoadingState>
      ) : recipesQuery.isError ? (
        <ErrorState
          message="Chưa tải được công thức để thêm vào thực đơn."
          onRetry={() => void recipesQuery.refetch()}
          retrying={recipesQuery.isFetching}
        />
      ) : !recipes.length ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <ul className="td-add-meal__recipes" aria-label="Công thức có thể thêm">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className={`td-add-meal__recipe${selectedId === recipe.id ? " is-selected" : ""}`}
                aria-pressed={selectedId === recipe.id}
                onClick={() => setSelectedId(recipe.id)}
              >
                <span className="td-add-meal__recipe-text">
                  <strong>{recipe.name}</strong>
                  <span>{recipe.cuisine} · {recipe.calories} kcal · {recipe.servings} khẩu phần</span>
                </span>
                <span className="td-add-meal__recipe-tags">
                  {recipe.dietTags.filter((tag) => tag !== "BALANCED").map((tag) => <span key={tag}>{recipeDietLabel(tag)}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="ui-notice ui-notice--error" role="alert">Chưa thêm được món: {error}</p>}
      <div className="ui-dialog__actions">
        <Button onClick={onClose} disabled={busy}>Hủy</Button>
        <Button variant="primary" busy={busy} disabled={!selected} onClick={save}>Thêm vào ngày</Button>
      </div>
    </Dialog>
  );
}
