import { CircleCheck, Hourglass, Info, Share2, TriangleAlert } from "lucide-react";
import {
  calorieShareLabel, expiringHint, forYouWarnings, missingIngredientItems, pantryCoverage, unitMismatchNote,
} from "../../features/recipes/recipe-for-you.logic";
import type { RecipeForYou } from "../../types";
import { ButtonLink, Card, ErrorState, Skeleton } from "../ui";

/** Cảnh báo theo hồ sơ (dị ứng, món không thích, không hợp chế độ ăn), nền --warn-bg, đặt ngay dưới tên món. */
export function RecipeForYouAlerts({ data }: { data?: RecipeForYou }) {
  const warnings = data ? forYouWarnings(data.warnings) : [];
  if (!warnings.length) return null;
  return (
    <section className="recipe-alerts" aria-label="Cảnh báo theo hồ sơ của bạn" role="alert">
      <ul>
        {warnings.map((warning) => <li key={warning.kind}><TriangleAlert aria-hidden="true" /><span>{warning.text}</span></li>)}
      </ul>
    </section>
  );
}

type RecipeForYouCardProps = {
  data?: RecipeForYou;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Đường dẫn chia sẻ lên cộng đồng (ẩn với món đã ngừng sử dụng — khi đó cả khối không hiện). */
  sharePath: string;
};

/** Cột phải (dính khi cuộn): có trong kho x/y, còn thiếu, % calo; nút chia sẻ. Lỗi/đang tải chỉ ảnh hưởng khối này. */
export default function RecipeForYouCard({ data, isLoading, isError, onRetry, sharePath }: RecipeForYouCardProps) {
  return (
    <Card as="aside" className="recipe-fit" aria-labelledby="recipe-fit-title" aria-busy={isLoading}>
      <h2 id="recipe-fit-title" className="ui-section-title">Dành cho bạn</h2>
      {isLoading ? (
        <div className="recipe-fit__loading" aria-hidden="true"><Skeleton kind="title" /><Skeleton /><Skeleton width="70%" /></div>
      ) : isError || !data ? (
        <ErrorState message="Chưa đối chiếu được với kho và hồ sơ của bạn." onRetry={onRetry} />
      ) : (
        <RecipeForYouContent data={data} />
      )}
      {/* GĐ5: nút "Thêm vào thực đơn" đặt cạnh nút chia sẻ. */}
      <ButtonLink className="recipe-fit__share" to={sharePath} icon={<Share2 />} block>Chia sẻ lên cộng đồng</ButtonLink>
    </Card>
  );
}

function RecipeForYouContent({ data }: { data: RecipeForYou }) {
  const fits = !forYouWarnings(data.warnings).length;
  const coverage = pantryCoverage(data.pantry);
  const missing = missingIngredientItems(data.pantry);
  const expiring = expiringHint(data.pantry.expiring);
  const unitNote = unitMismatchNote(data.pantry.unitMismatches);

  return (
    <div className="recipe-fit__content">
      {fits && <p className="recipe-fit__ok"><CircleCheck aria-hidden="true" />Hợp với dị ứng, món không thích và chế độ ăn của bạn.</p>}

      <div className="recipe-fit__block">
        <div className="recipe-fit__row"><span>Nguyên liệu có trong kho</span><strong>{coverage.label}</strong></div>
        <div className="recipe-fit__bar" aria-hidden="true"><span style={{ width: `${coverage.percent}%` }} /></div>
        {missing.length ? (
          <div>
            <p className="recipe-fit__label">Còn thiếu</p>
            <ul className="recipe-fit__missing">
              {missing.map((item) => <li key={item.name}>{item.name}{item.note && <span className="recipe-fit__note"> ({item.note})</span>}</li>)}
            </ul>
          </div>
        ) : (
          <p className="recipe-fit__ok"><CircleCheck aria-hidden="true" />Kho đã có đủ nguyên liệu.</p>
        )}
        {expiring && <p className="recipe-fit__expiring"><Hourglass aria-hidden="true" />{expiring}</p>}
        {unitNote && <p className="recipe-fit__info"><Info aria-hidden="true" />{unitNote}</p>}
      </div>

      <div className="recipe-fit__block">
        <div className="recipe-fit__row"><span>Calo 1 khẩu phần so với mục tiêu ngày</span><strong>{data.calories.percentOfDailyTarget}%</strong></div>
        <div className="recipe-fit__bar recipe-fit__bar--calories" aria-hidden="true">
          <span style={{ width: `${Math.min(100, data.calories.percentOfDailyTarget)}%` }} />
        </div>
        <p className="ui-small">{calorieShareLabel(data.calories)}</p>
      </div>
    </div>
  );
}
