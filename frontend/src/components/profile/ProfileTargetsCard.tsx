import { formatNumber } from "../../features/dashboard/dashboard.logic";
import type { NutritionProfile } from "../../types";
import { Card } from "../ui";

type ProfileTargetsCardProps = {
  /** Hồ sơ đã lưu (chỉ tiêu do backend tính bằng calculateNutritionTargets khi lưu). */
  profile: NutritionProfile | null | undefined;
  dirty: boolean;
  bmi: number | null;
};

/** Chỉ tiêu dinh dưỡng mỗi ngày từ dữ liệu thật; cập nhật sau khi lưu hồ sơ. ≥ 1024px ở cột phải, điện thoại ở trên cùng. */
export function ProfileTargetsCard({ profile, dirty, bmi }: ProfileTargetsCardProps) {
  const hasTargets = Boolean(profile?.dailyCalorieTarget);
  return (
    <Card as="aside" className="hs-targets" aria-labelledby="hs-targets-title">
      <h2 id="hs-targets-title" className="hs-targets__title">Chỉ tiêu mỗi ngày</h2>
      {hasTargets ? (
        <>
          <p className="hs-targets__calories">
            <span className="hs-targets__number">{formatNumber(profile!.dailyCalorieTarget!)}</span>
            <span className="hs-targets__unit">kcal mỗi ngày</span>
          </p>
          <dl className="hs-targets__macros">
            <div><dt>Đạm</dt><dd>{formatNumber(profile!.proteinTargetG ?? 0)} g</dd></div>
            <div><dt>Tinh bột</dt><dd>{formatNumber(profile!.carbTargetG ?? 0)} g</dd></div>
            <div><dt>Béo</dt><dd>{formatNumber(profile!.fatTargetG ?? 0)} g</dd></div>
          </dl>
        </>
      ) : (
        <p className="ui-text">Lưu hồ sơ để Nouri tính calo, đạm, tinh bột và béo mỗi ngày.</p>
      )}
      {dirty && hasTargets && <p className="hs-targets__dirty">Số liệu trên theo hồ sơ đã lưu; bấm "Lưu hồ sơ" để tính lại.</p>}
      <p className="ui-small hs-targets__how">
        Cách tính: năng lượng nghỉ theo công thức Mifflin–St Jeor (tuổi, giới tính, chiều cao, cân nặng) nhân hệ số vận động, rồi trừ
        350 kcal khi giảm cân hoặc cộng 300 kcal khi tăng cân, tăng cơ; tối thiểu 1.200 kcal. Đạm chiếm 25% (tăng cơ 30%), béo 28%,
        còn lại là tinh bột. Chưa nhập số đo thì dùng 25 tuổi, 165 cm, 60 kg.
      </p>
      {bmi !== null && (
        <p className="ui-small">Chỉ số BMI theo số đo đang nhập: {bmi.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}.</p>
      )}
      <p className="ui-small">Số liệu để tham khảo, không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.</p>
    </Card>
  );
}
