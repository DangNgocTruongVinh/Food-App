import { LANDING_STEPS } from "../../features/landing/landing.data";

/** "Cách hoạt động": trình tự thật khi bắt đầu dùng (nhập kho, hồ sơ, thực đơn, đi chợ), nên được đánh số. */
export function LandingSteps() {
  return (
    <section id="cach-hoat-dong" className="ld-section" aria-labelledby="ld-steps-title">
      <div className="ld-section__inner">
        <div className="ld-section__head">
          <h2 id="ld-steps-title" className="ld-section__title">Cách hoạt động</h2>
          <p className="ld-section__lead">Bốn bước cho tuần đầu tiên, theo đúng thứ tự bạn sẽ làm.</p>
        </div>
        <ol className="ld-steps">
          {LANDING_STEPS.map((step, index) => (
            <li key={step.title} className="ld-step">
              <span className="ld-step__number" aria-hidden="true">{index + 1}</span>
              <h3 className="ld-step__title">{step.title}</h3>
              <p className="ld-step__body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
