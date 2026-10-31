import { Card } from "../ui";

/** Các bước nấu: đánh số vì là trình tự (ngoại lệ duy nhất cho việc đánh số, DESIGN.md mục 3.1). */
export default function RecipeStepsCard({ instructions }: { instructions: string[] }) {
  return (
    <Card as="section" className="recipe-panel" aria-labelledby="recipe-steps-title">
      <h2 id="recipe-steps-title" className="ui-section-title">Cách làm</h2>
      {instructions.length ? (
        <ol className="recipe-steps">
          {instructions.map((step, index) => (
            <li key={`${index}-${step}`}>
              <span className="recipe-steps__number" aria-hidden="true">{index + 1}</span>
              <p className="ui-text">{step}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ui-text">Công thức chưa có hướng dẫn thực hiện.</p>
      )}
    </Card>
  );
}
