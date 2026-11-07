import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { recipeQueries } from "../../features/recipes/recipes.queries";
import { addableRecipes, portionOptions } from "../../features/meal-plans/add-meal.logic";
import { mealLabels } from "../../features/meal-plans/meal-plans.logic";
import type { MealType } from "../../types";
import { Button, Dialog, EmptyState, ErrorState, LoadingState, Skeleton } from "../ui";

type AddMealDialogProps = {
  dayId: string;
  mealType: MealType;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (recipeId: string, servings: number) => void;
};

/** Hộp chọn công thức có sẵn cho một bữa; danh sách đã kèm fit do backend tính theo hồ sơ hiện tại. */
export function AddMealDialog({ mealType, busy, error, onClose, onSubmit }: AddMealDialogProps) {
  const recipesQuery = useQuery(recipeQueries.list());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [servings, setServings] = useState("1");
  const recipes = useMemo(() => addableRecipes(recipesQuery.data ?? [], mealType, search), [mealType, recipesQuery.data, search]);
  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const save = () => {
    const value = Number(servings);
    if (selected && Number.isFinite(value) && value > 0) onSubmit(selected.id, value);
  };

  return (
    <Dialog
      title={`Thêm món ${mealLabels[mealType].toLowerCase()}`}
      description="Chọn một công thức có sẵn, không nhập món tự do. Món không hợp dị ứng hoặc chế độ ăn đã được loại khỏi danh sách."
      onClose={onClose}
      className="td-add-meal"
    >
      <label className="td-add-meal__search" htmlFor="td-add-meal-search">
        <span>Tìm công thức</span>
        <span className="td-add-meal__search-input"><Search aria-hidden="true" /><input id="td-add-meal-search" className="ui-input" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus /></span>
      </label>
      {recipesQuery.isLoading ? (
        <LoadingState label="Đang tải công thức">
          {[0, 1, 2].map((item) => <Skeleton key={item} kind="block" height={64} />)}
        </LoadingState>
      ) : recipesQuery.isError ? (
        <ErrorState message="Chưa tải được công thức để thêm vào thực đơn." onRetry={() => void recipesQuery.refetch()} retrying={recipesQuery.isFetching} />
      ) : !recipes.length ? (
        <EmptyState message={search ? "Không có công thức nào khớp với tìm kiếm cho bữa này." : "Chưa có công thức phù hợp cho bữa này."} />
      ) : (
        <ul className="td-add-meal__recipes" aria-label="Công thức có thể thêm">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className={`td-add-meal__recipe${selectedId === recipe.id ? " is-selected" : ""}`} aria-pressed={selectedId === recipe.id} onClick={() => setSelectedId(recipe.id)}>
                <span className="td-add-meal__recipe-text"><strong>{recipe.name}</strong><span>{recipe.cuisine} · {recipe.calories} kcal · {recipe.servings} khẩu phần</span></span>
                <span className="td-add-meal__recipe-tags">{recipe.dietTags.filter((tag) => tag !== "BALANCED").map((tag) => <span key={tag}>{tag === "VEGAN" ? "Thuần chay" : tag === "VEGETARIAN" ? "Món chay" : tag === "LOW_CARB" ? "Ít tinh bột" : "Giàu đạm"}</span>)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="td-add-meal__portion">
        <label htmlFor="td-add-meal-servings">Khẩu phần</label>
        <select id="td-add-meal-servings" className="ui-input" value={servings} onChange={(event) => setServings(event.target.value)} disabled={!selected || busy}>
          {portionOptions.map((value) => <option key={value} value={value}>{value} khẩu phần</option>)}
        </select>
      </div>
      {error && <p className="ui-notice ui-notice--error" role="alert">Chưa thêm được món: {error}</p>}
      <div className="ui-dialog__actions">
        <Button onClick={onClose} disabled={busy}>Hủy</Button>
        <Button variant="primary" busy={busy} disabled={!selected} onClick={save}>Thêm vào bữa</Button>
      </div>
    </Dialog>
  );
}
