import { CircleCheck, Flame, Hourglass, Info, Refrigerator, TriangleAlert } from "lucide-react";
import {
  calorieShareLabel, expiringHint, forYouWarnings, missingIngredientItems, pantryCoverage, unitMismatchNote,
} from "../../features/recipes/recipe-for-you.logic";
import type { RecipeForYou } from "../../types";

type RecipeForYouCardProps = { data?: RecipeForYou; isLoading: boolean; isError: boolean; onRetry: () => void };

/** Khối "Dành cho bạn": lỗi hoặc đang tải chỉ ảnh hưởng khối này, không ảnh hưởng phần còn lại của trang. */
export default function RecipeForYouCard({ data, isLoading, isError, onRetry }: RecipeForYouCardProps) {
  return <section className="recipe-detail-card recipe-for-you" aria-label="Dành cho bạn" aria-busy={isLoading}>
    <h2>Dành cho bạn</h2>
    {isLoading
      ? <p className="recipe-detail-empty">Đang đối chiếu với kho và hồ sơ của bạn...</p>
      : isError || !data
        ? <div className="recipe-for-you-error">
          <p>Chưa tải được thông tin dành cho bạn.</p>
          <button type="button" className="button ghost" onClick={onRetry}>Thử lại</button>
        </div>
        : <RecipeForYouContent data={data} />}
  </section>;
}

function RecipeForYouContent({ data }: { data: RecipeForYou }) {
  const warnings = forYouWarnings(data.warnings);
  const coverage = pantryCoverage(data.pantry);
  const missing = missingIngredientItems(data.pantry);
  const expiring = expiringHint(data.pantry.expiring);
  const unitNote = unitMismatchNote(data.pantry.unitMismatches);
  const caloriePercent = Math.min(100, data.calories.percentOfDailyTarget);

  return <>
    {warnings.length
      ? <ul className="recipe-for-you-warnings" role="alert">
        {warnings.map((warning) => <li key={warning.kind}><TriangleAlert /><span>{warning.text}</span></li>)}
      </ul>
      : <p className="recipe-for-you-ok"><CircleCheck /> Phù hợp với dị ứng, món không thích và chế độ ăn của bạn.</p>}

    <div className="recipe-for-you-block">
      <div className="recipe-for-you-row"><span><Refrigerator /> Nguyên liệu có trong kho</span><strong>{coverage.label}</strong></div>
      <div className="recipe-for-you-bar"><i style={{ width: `${coverage.percent}%` }} /></div>
      {missing.length
        ? <div className="recipe-for-you-missing">
          <small>Còn thiếu</small>
          <ul>{missing.map((item) => <li key={item.name}>{item.name}{item.note && <small> ({item.note})</small>}</li>)}</ul>
        </div>
        : <p className="recipe-for-you-ok"><CircleCheck /> Kho đã có đủ nguyên liệu.</p>}
      {expiring && <p className="recipe-for-you-expiring"><Hourglass /> {expiring}</p>}
      {unitNote && <p className="recipe-for-you-note"><Info /> {unitNote}</p>}
    </div>

    <div className="recipe-for-you-block">
      <div className="recipe-for-you-row"><span><Flame /> Calo so với mục tiêu ngày</span><strong>{data.calories.percentOfDailyTarget}%</strong></div>
      <div className="recipe-for-you-bar calories"><i style={{ width: `${caloriePercent}%` }} /></div>
      <small className="recipe-for-you-caption">{calorieShareLabel(data.calories)}</small>
    </div>
  </>;
}
