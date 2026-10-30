import { CircleCheck, Flame, Hourglass, Info, Refrigerator, TriangleAlert } from "lucide-react";
import {
  calorieShareLabel, expiringHint, forYouWarnings, missingIngredientItems, pantryCoverage, unitMismatchNote,
} from "../../features/recipes/recipe-for-you.logic";
import type { RecipeForYou } from "../../types";

type RecipeForYouCardProps = { data?: RecipeForYou; isLoading: boolean; isError: boolean; onRetry: () => void };

/**
 * Cảnh báo theo hồ sơ đặt ngay sau phần thông tin chính, chỉ hiện trên màn hình hẹp (CSS); khi đó danh sách cảnh báo
 * trong khối "Dành cho bạn" bị ẩn để không lặp. Máy tính vẫn xem cảnh báo trong khối như cũ.
 */
export function RecipeForYouAlerts({ data }: { data?: RecipeForYou }) {
  const warnings = data ? forYouWarnings(data.warnings) : [];
  if (!warnings.length) return null;
  return <section className="recipe-for-you-alerts" aria-label="Cảnh báo theo hồ sơ của bạn">
    <WarningList warnings={warnings} />
  </section>;
}

function WarningList({ warnings, className = "" }: { warnings: ReturnType<typeof forYouWarnings>; className?: string }) {
  return <ul className={`recipe-for-you-warnings ${className}`.trim()} role="alert">
    {warnings.map((warning) => <li key={warning.kind}><TriangleAlert /><span>{warning.text}</span></li>)}
  </ul>;
}

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
      ? <WarningList warnings={warnings} className="in-card" />
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
      <div className="recipe-for-you-row">
        <span><Flame /> Calo 1 khẩu phần so với mục tiêu ngày</span><strong>{data.calories.percentOfDailyTarget}%</strong>
      </div>
      <div className="recipe-for-you-bar calories"><i style={{ width: `${caloriePercent}%` }} /></div>
      <small className="recipe-for-you-caption">{calorieShareLabel(data.calories)}</small>
    </div>
  </>;
}
