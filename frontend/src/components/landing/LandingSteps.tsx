import { LANDING_STEPS } from "../../features/landing/landing.data";

/** "Cách hoạt động": trình tự thật khi bắt đầu dùng (nhập kho, hồ sơ, thực đơn, đi chợ), nên được đánh số. */
export function LandingSteps() {
  return (
    <section id="cach-hoat-dong" className="ld-section" aria-labelledby="ld-steps-title">
      <div className="ld-section__inner">
        <h2 id="ld-steps-title" className="ui-section-title">Cách hoạt động</h2>
        <ol className="ld-steps">
          {LANDING_STEPS.map((step, index) => (
            <li key={step.title} className="ld-step">
              <span className="ld-step__number" aria-hidden="true">{index + 1}</span>
              <h3 className="ld-step__title">{step.title}</h3>
              <p className="ld-text">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
