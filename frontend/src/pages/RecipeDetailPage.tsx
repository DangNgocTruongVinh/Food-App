import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowLeft, Beef, Clock3, CookingPot, Droplet, Flame, Leaf, UsersRound, Wheat } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import RecipeForYouCard from "../components/recipes/RecipeForYouCard";
import { EmptyState, LoadingState } from "../components/States";
import {
  formatIngredientAmount, recipeDietLabel, recipeImageSrc, recipeTotalMinutes,
} from "../features/recipes/recipes.logic";
import { recipeQueries } from "../features/recipes/recipes.queries";

const backLink = <Link className="button ghost" to="/recipes"><ArrowLeft /> Về danh sách công thức</Link>;

export default function RecipeDetailPage() {
  const { id = "" } = useParams();
  const { data: recipe, isLoading, isError, error, refetch } = useQuery(recipeQueries.detail(id));
  const forYou = useQuery(recipeQueries.forYou(id));

  if (isLoading) return <LoadingState />;
  if (isError || !recipe) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    const notFound = status !== undefined && status >= 400 && status < 500;
    return <div className="page recipe-detail-page">
      {notFound
        ? <EmptyState title="Không tìm thấy công thức" action={backLink}>Công thức này không tồn tại hoặc đã bị xóa.</EmptyState>
        : <EmptyState title="Không tải được công thức" action={<button className="button primary" onClick={() => void refetch()}>Thử lại</button>}>Vui lòng kiểm tra kết nối và thử lại.</EmptyState>}
    </div>;
  }

  const nutrition = [
    { icon: Flame, label: "Năng lượng", value: `${recipe.calories} kcal` },
    { icon: Beef, label: "Protein", value: `${recipe.proteinG} g` },
    { icon: Wheat, label: "Tinh bột", value: `${recipe.carbsG} g` },
    { icon: Droplet, label: "Chất béo", value: `${recipe.fatG} g` },
    { icon: Leaf, label: "Chất xơ", value: `${recipe.fiberG} g` },
  ];

  return <div className="page recipe-detail-page">
    <nav className="recipe-detail-nav" aria-label="Điều hướng công thức"><Link to="/recipes"><ArrowLeft /> Công thức</Link></nav>

    <header className="recipe-detail-hero">
      <img src={recipeImageSrc(recipe)} alt={recipe.name} />
      <div className="recipe-detail-intro">
        <div className="recipe-detail-tags"><b>{recipe.cuisine}</b>{recipe.dietTags.map((tag) => <b key={tag}>{recipeDietLabel(tag)}</b>)}</div>
        <h1>{recipe.name}</h1>
        <p>{recipe.description}</p>
        <ul className="recipe-detail-facts">
          <li><Clock3 /><span><strong>{recipeTotalMinutes(recipe)} phút</strong><small>Sơ chế {recipe.prepMinutes} · Nấu {recipe.cookMinutes}</small></span></li>
          <li><UsersRound /><span><strong>{recipe.servings} khẩu phần</strong><small>Theo công thức</small></span></li>
          <li><CookingPot /><span><strong>{recipe.ingredients.length} nguyên liệu</strong><small>{recipe.instructions.length} bước thực hiện</small></span></li>
        </ul>
        {/* GĐ5: nút "Thêm vào thực đơn" đặt cạnh liên kết quay lại trong khối hành động này. */}
        <div className="recipe-detail-actions">{backLink}</div>
      </div>
    </header>

    <section className="recipe-detail-nutrition" aria-label="Dinh dưỡng mỗi khẩu phần">
      {nutrition.map(({ icon: Icon, label, value }) => <article key={label}><Icon /><strong>{value}</strong><small>{label}</small></article>)}
    </section>

    <div className="recipe-detail-body">
      <section className="recipe-detail-card">
        <h2>Nguyên liệu</h2>
        {recipe.ingredients.length ? <ul className="recipe-detail-ingredients">
          {recipe.ingredients.map((ingredient) => <li key={ingredient.id}>
            <span>{ingredient.name}{ingredient.optional && <small> (tùy chọn)</small>}</span>
            <strong>{formatIngredientAmount(ingredient)}</strong>
          </li>)}
        </ul> : <p className="recipe-detail-empty">Công thức chưa có danh sách nguyên liệu.</p>}
      </section>

      <div className="recipe-detail-side">
        <section className="recipe-detail-card">
          <h2>Cách làm</h2>
          {recipe.instructions.length ? <ol className="recipe-detail-steps">
            {recipe.instructions.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}
          </ol> : <p className="recipe-detail-empty">Công thức chưa có hướng dẫn thực hiện.</p>}
        </section>

        <RecipeForYouCard data={forYou.data} isLoading={forYou.isLoading} isError={forYou.isError} onRetry={() => void forYou.refetch()} />
      </div>
    </div>
  </div>;
}
