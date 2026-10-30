export default function RecipeStepsCard({ instructions }: { instructions: string[] }) {
  return <section className="recipe-detail-card">
    <h2>Cách làm</h2>
    {instructions.length ? <ol className="recipe-detail-steps">
      {instructions.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}
    </ol> : <p className="recipe-detail-empty">Công thức chưa có hướng dẫn thực hiện.</p>}
  </section>;
}
