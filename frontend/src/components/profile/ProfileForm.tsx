import type { FormEvent, ReactNode } from "react";
import type { ProfileFormValues } from "../../features/profile/profile.api";
import {
  ACTIVITY_OPTIONS, CUISINE_SUGGESTIONS, DIET_OPTIONS, GENDER_OPTIONS, GOAL_OPTIONS, MEALS_OPTIONS, PROFILE_LIMITS, type ProfileFormErrors,
} from "../../features/profile/profile.logic";
import { Button, ChoiceGroup, ErrorState, Field } from "../ui";
import { TagField } from "./TagField";

type ProfileFormProps = {
  form: ProfileFormValues;
  email: string | undefined;
  errors: ProfileFormErrors;
  dirty: boolean;
  saving: boolean;
  saveError: string;
  onChange: <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => void;
  onSubmit: (event: FormEvent) => void;
};

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="hs-section" aria-labelledby={id}>
      <header className="hs-section__head">
        <h2 id={id} className="hs-section__title">{title}</h2>
        <p className="ui-small">{description}</p>
      </header>
      <div className="hs-section__fields">{children}</div>
    </section>
  );
}

/** Form hồ sơ chia 4 nhóm; một nút "Lưu hồ sơ" ở cuối form. Lỗi hiện dưới từng trường. */
export function ProfileForm({ form, email, errors, dirty, saving, saveError, onChange, onSubmit }: ProfileFormProps) {
  const numberInput = (key: "age" | "heightCm" | "weightKg" | "targetWeightKg", label: string, unit: string, hint?: string) => (
    <Field label={label} error={errors[key]} hint={hint}>
      {(control) => (
        <span className="hs-unit">
          <input
            {...control}
            type="number"
            inputMode="decimal"
            step={key === "age" ? 1 : 0.1}
            value={form[key]}
            onChange={(event) => onChange(key, event.target.value)}
          />
          <span className="hs-unit__label" aria-hidden="true">{unit}</span>
        </span>
      )}
    </Field>
  );

  return (
    <form id="profile-form" className="hs-form" noValidate onSubmit={onSubmit}>
      <Section id="hs-basic" title="Thông tin cơ bản" description="Tuổi, giới tính, chiều cao và cân nặng dùng để tính năng lượng mỗi ngày.">
        <Field label="Họ và tên" error={errors.name} className="hs-wide">
          {(control) => <input {...control} autoComplete="name" value={form.name} onChange={(event) => onChange("name", event.target.value)} />}
        </Field>
        <p className="hs-email hs-wide"><span className="ui-field__label">Email đăng nhập</span><span>{email ?? "Đang tải..."}</span></p>
        {numberInput("age", "Tuổi", "tuổi")}
        <ChoiceGroup legend="Giới tính" name="gender" options={GENDER_OPTIONS} value={form.gender} onChange={(value) => onChange("gender", value)} />
        {numberInput("heightCm", "Chiều cao", "cm")}
        {numberInput("weightKg", "Cân nặng hiện tại", "kg")}
      </Section>

      <Section id="hs-goal" title="Mục tiêu" description="Mục tiêu và mức vận động quyết định lượng calo cộng hoặc trừ mỗi ngày.">
        <ChoiceGroup className="hs-wide" legend="Mục tiêu" name="goal" options={GOAL_OPTIONS} value={form.goal} onChange={(value) => onChange("goal", value)} />
        {numberInput("targetWeightKg", "Cân nặng mục tiêu", "kg", "Không bắt buộc.")}
        <Field label="Mức độ vận động">
          {(control) => (
            <select {...control} value={form.activityLevel} onChange={(event) => onChange("activityLevel", event.target.value)}>
              {ACTIVITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          )}
        </Field>
      </Section>

      <Section id="hs-diet" title="Chế độ ăn và dị ứng" description="Món không hợp chế độ ăn hoặc có thứ bạn dị ứng sẽ không được gợi ý và có cảnh báo.">
        <ChoiceGroup className="hs-wide" legend="Chế độ ăn" name="dietType" options={DIET_OPTIONS} value={form.dietType} onChange={(value) => onChange("dietType", value)} />
        <ChoiceGroup
          className="hs-wide"
          legend="Số bữa mỗi ngày"
          name="mealsPerDay"
          options={MEALS_OPTIONS}
          value={form.mealsPerDay}
          error={errors.mealsPerDay}
          onChange={(value) => onChange("mealsPerDay", value)}
        />
        <TagField
          className="hs-wide"
          label="Dị ứng"
          itemName="dị ứng"
          tags={form.allergies}
          max={PROFILE_LIMITS.allergies}
          placeholder="Ví dụ: tôm, đậu phộng"
          hint="Gõ rồi bấm Enter để thêm từng mục. Nouri so khớp theo nhóm: Hải sản, Sữa, Trứng, Đậu phộng, Gluten."
          onChange={(tags) => onChange("allergies", tags)}
        />
        <TagField
          className="hs-wide"
          label="Món không thích"
          itemName="món không thích"
          tags={form.dislikedFoods}
          max={PROFILE_LIMITS.dislikedFoods}
          placeholder="Ví dụ: cần tây"
          onChange={(tags) => onChange("dislikedFoods", tags)}
        />
      </Section>

      <Section id="hs-taste" title="Khẩu vị" description="Nền ẩm thực bạn hay nấu, dùng khi gợi ý món và tạo thực đơn.">
        <TagField
          className="hs-wide"
          label="Ẩm thực ưa thích"
          itemName="ẩm thực"
          tags={form.preferredCuisines}
          max={PROFILE_LIMITS.preferredCuisines}
          placeholder="Ví dụ: Việt Nam"
          suggestions={CUISINE_SUGGESTIONS}
          onChange={(tags) => onChange("preferredCuisines", tags)}
        />
      </Section>

      <div className="hs-actions">
        {saveError && <ErrorState message={saveError} />}
        <div className="hs-actions__bar">
          <p className="hs-actions__note" aria-live="polite">{dirty ? "Có thay đổi chưa lưu." : "Hồ sơ đã lưu."}</p>
          <Button type="submit" variant="primary" busy={saving}>{saving ? "Đang lưu..." : "Lưu hồ sơ"}</Button>
        </div>
      </div>
    </form>
  );
}
