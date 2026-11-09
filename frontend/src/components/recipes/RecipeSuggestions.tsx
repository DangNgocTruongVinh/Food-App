import { useQuery } from "@tanstack/react-query";
import { recommendationQueries } from "../../features/recommendations/recommendations.api";
import { RecommendationList } from "../recommendations/RecommendationList";

const LIMIT = 4;

/**
 * Cuối trang chi tiết món (GĐ3b-R7): "Món tương tự" (thuật toán 1: cùng nguyên liệu, ẩm thực, dinh dưỡng) và "Người khác cũng nấu"
 * (thuật toán 2, chỉ từ số liệu tổng hợp; chưa đủ người cùng nấu thì backend trả rỗng và khối này ẩn hẳn).
 */
export function RecipeSuggestions({ recipeId, recipeName }: { recipeId: string; recipeName: string }) {
  const similar = useQuery(recommendationQueries.list({ context: "similar", recipeId, limit: LIMIT }));
  const alsoCooked = useQuery(recommendationQueries.list({ context: "also-cooked", recipeId, limit: LIMIT }));
  const showAlsoCooked = alsoCooked.isLoading || Boolean(alsoCooked.data?.items.length);

  return (
    <>
      <section className="rc-section recipe-detail__suggestions" aria-labelledby="rc-similar-title">
        <header className="rc-section__head">
          <h2 id="rc-similar-title" className="rc-section__title">Món tương tự</h2>
          <p className="ui-text">Gần với {recipeName} về nguyên liệu, ẩm thực và dinh dưỡng; đã lọc theo hồ sơ của bạn.</p>
        </header>
        <RecommendationList
          entries={similar.data?.items ?? []}
          isLoading={similar.isLoading}
          isError={similar.isError}
          isFetching={similar.isFetching}
          onRetry={() => void similar.refetch()}
          loadingLabel="Đang tìm món tương tự"
          errorMessage="Chưa tải được món tương tự."
          emptyMessage="Chưa có món tương tự hợp với hồ sơ của bạn."
          skeletonCount={LIMIT}
        />
      </section>
      {showAlsoCooked && !alsoCooked.isError && (
        <section className="rc-section recipe-detail__suggestions" aria-labelledby="rc-also-title">
          <header className="rc-section__head">
            <h2 id="rc-also-title" className="rc-section__title">Người khác cũng nấu</h2>
            <p className="ui-text">Những người nấu {recipeName} cũng hay nấu các món này (tính từ số liệu chung, không hiện thông tin cá nhân).</p>
          </header>
          <RecommendationList
            entries={alsoCooked.data?.items ?? []}
            isLoading={alsoCooked.isLoading}
            loadingLabel="Đang tải món người khác cũng nấu"
            errorMessage="Chưa tải được."
            emptyMessage={null}
            skeletonCount={LIMIT}
          />
        </section>
      )}
    </>
  );
}
