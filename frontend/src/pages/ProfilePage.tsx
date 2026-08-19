import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Calculator, Check, ChevronRight,
  HeartPulse, Leaf, Mail, Ruler, Save, Scale, ShieldCheck, Sparkles, Target,
  UserRound, Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { LoadingState } from "../components/States";
import type { ProfileResponse } from "../types";

const join = (items?: string[]) => items?.join(", ") ?? "";
const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

const goalLabels: Record<string, string> = {
  LOSE_WEIGHT: "Giảm cân",
  MAINTAIN: "Duy trì vóc dáng",
  GAIN_WEIGHT: "Tăng cân",
  BUILD_MUSCLE: "Tăng cơ",
};

const dietLabels: Record<string, string> = {
  BALANCED: "Ăn cân bằng",
  VEGETARIAN: "Ăn chay",
  VEGAN: "Thuần chay",
  LOW_CARB: "Ít tinh bột",
  HIGH_PROTEIN: "Giàu protein",
};

const initialForm = {
  name: "",
  age: "",
  gender: "FEMALE",
  heightCm: "",
  weightKg: "",
  targetWeightKg: "",
  activityLevel: "MODERATE",
  goal: "MAINTAIN",
  dietType: "BALANCED",
  mealsPerDay: "3",
  allergies: "",
  dislikedFoods: "",
  preferredCuisines: "Việt Nam",
};

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await api.get<ProfileResponse>("/profile")).data,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      age: String(data.profile?.age ?? ""),
      gender: data.profile?.gender ?? "FEMALE",
      heightCm: String(data.profile?.heightCm ?? ""),
      weightKg: String(data.profile?.weightKg ?? ""),
      targetWeightKg: String(data.profile?.targetWeightKg ?? ""),
      activityLevel: data.profile?.activityLevel ?? "MODERATE",
      goal: data.profile?.goal ?? "MAINTAIN",
      dietType: data.profile?.dietType ?? "BALANCED",
      mealsPerDay: String(data.profile?.mealsPerDay ?? 3),
      allergies: join(data.profile?.allergies),
      dislikedFoods: join(data.profile?.dislikedFoods),
      preferredCuisines: join(data.profile?.preferredCuisines),
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put("/profile", {
      ...form,
      age: form.age ? Number(form.age) : null,
      heightCm: form.heightCm ? Number(form.heightCm) : null,
      weightKg: form.weightKg ? Number(form.weightKg) : null,
      targetWeightKg: form.targetWeightKg ? Number(form.targetWeightKg) : null,
      mealsPerDay: Number(form.mealsPerDay),
      allergies: split(form.allergies),
      dislikedFoods: split(form.dislikedFoods),
      preferredCuisines: split(form.preferredCuisines),
    }),
    onSuccess: () => {
      setSuccess(true);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      window.setTimeout(() => setSuccess(false), 2500);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const profileCompletion = useMemo(() => {
    const fields = [form.name, form.age, form.heightCm, form.weightKg, form.targetWeightKg, form.preferredCuisines];
    return Math.round(fields.filter(Boolean).length / fields.length * 100);
  }, [form]);

  const bmi = useMemo(() => {
    const height = Number(form.heightCm) / 100;
    const weight = Number(form.weightKg);
    return height > 0 && weight > 0 ? weight / (height * height) : null;
  }, [form.heightCm, form.weightKg]);

  const bmiCopy = !bmi ? "Chưa đủ dữ liệu" : bmi < 18.5 ? "Hơi nhẹ cân" : bmi < 25 ? "Trong khoảng tốt" : bmi < 30 ? "Hơi thừa cân" : "Cần lưu ý";
  const weightDifference = form.weightKg && form.targetWeightKg ? Number(form.targetWeightKg) - Number(form.weightKg) : null;
  const profile = data?.profile;
  const calories = profile?.dailyCalorieTarget ?? 0;
  const protein = profile?.proteinTargetG ?? 0;
  const carbs = profile?.carbTargetG ?? 0;
  const fat = profile?.fatTargetG ?? 0;
  const maxMacro = Math.max(protein, carbs, fat, 1);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSuccess(false);
    setError("");
    save.mutate();
  };

  if (isLoading) return <LoadingState />;

  return <div className="page professional-profile-page">
    <header className="professional-profile-header">
      <div><span className="eyebrow"><Sparkles /> Cá nhân hóa dinh dưỡng</span><h1>Hồ sơ của bạn</h1><p>Cập nhật thông tin để NutriPlan xây dựng mục tiêu và thực đơn phù hợp hơn.</p></div>
      <button form="nutrition-profile-form" className="button profile-save-top" disabled={save.isPending}><Save />{save.isPending ? "Đang lưu..." : "Lưu thay đổi"}</button>
    </header>

    <section className="profile-identity-card">
      <div className="profile-avatar"><span>{form.name.trim().charAt(0).toUpperCase() || "N"}</span><i><Check /></i></div>
      <div className="profile-identity-copy"><span>Hồ sơ dinh dưỡng</span><h2>{form.name || "Người dùng NutriPlan"}</h2><p><Mail /> {data?.email ?? "Chưa có email"}</p></div>
      <div className="profile-summary-tags"><span><Target />{goalLabels[form.goal]}</span><span><Leaf />{dietLabels[form.dietType]}</span><span><Utensils />{form.mealsPerDay} bữa/ngày</span></div>
      <div className="profile-completion"><div><span>Mức độ hoàn thiện</span><b>{profileCompletion}%</b></div><div className="profile-completion-track"><span style={{ width: `${profileCompletion}%` }} /></div><small>{profileCompletion === 100 ? "Tuyệt vời! Hồ sơ của bạn đã đầy đủ." : "Bổ sung đủ thông tin để AI đưa ra gợi ý chính xác hơn."}</small></div>
    </section>

    <div className="professional-profile-layout">
      <form id="nutrition-profile-form" className="professional-profile-form" onSubmit={submit}>
        <section className="profile-form-card">
          <header className="profile-section-header"><span><UserRound /></span><div><small>Thông tin cá nhân</small><h2>Thông tin cơ bản</h2><p>Những thông tin giúp chúng tôi hiểu rõ hơn về bạn.</p></div><b>01</b></header>
          <div className="profile-fields profile-fields-personal">
            <label className="profile-field-wide">Họ và tên<div><UserRound /><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Nhập họ và tên" /></div></label>
            <label>Tuổi<div><Activity /><input type="number" min="13" max="120" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} placeholder="25" /></div></label>
            <label>Giới tính<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="FEMALE">Nữ</option><option value="MALE">Nam</option><option value="OTHER">Khác</option></select></label>
          </div>
        </section>

        <section className="profile-form-card">
          <header className="profile-section-header"><span className="orange"><Scale /></span><div><small>Chỉ số sức khỏe</small><h2>Thông số cơ thể</h2><p>Dùng để ước tính năng lượng và tỷ lệ dinh dưỡng mỗi ngày.</p></div><b>02</b></header>
          <div className="profile-fields profile-body-fields">
            <label>Chiều cao<div><Ruler /><input type="number" min="100" max="250" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: event.target.value })} placeholder="165" /><em>cm</em></div></label>
            <label>Cân nặng hiện tại<div><Scale /><input type="number" min="25" max="400" step="0.1" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} placeholder="55" /><em>kg</em></div></label>
            <label>Cân nặng mục tiêu<div><Target /><input type="number" min="25" max="400" step="0.1" value={form.targetWeightKg} onChange={(event) => setForm({ ...form, targetWeightKg: event.target.value })} placeholder="52" /><em>kg</em></div></label>
            <label className="profile-field-wide">Mức độ vận động<select value={form.activityLevel} onChange={(event) => setForm({ ...form, activityLevel: event.target.value })}><option value="SEDENTARY">Ít vận động — chủ yếu ngồi</option><option value="LIGHT">Nhẹ — 1–3 buổi/tuần</option><option value="MODERATE">Vừa — 3–5 buổi/tuần</option><option value="ACTIVE">Nhiều — 6–7 buổi/tuần</option><option value="VERY_ACTIVE">Rất nhiều — vận động cường độ cao</option></select></label>
          </div>
        </section>

        <section className="profile-form-card">
          <header className="profile-section-header"><span className="blue"><HeartPulse /></span><div><small>Mục tiêu và sở thích</small><h2>Chế độ dinh dưỡng</h2><p>AI sẽ ưu tiên các món ăn phù hợp với lựa chọn của bạn.</p></div><b>03</b></header>
          <div className="profile-fields">
            <label>Mục tiêu<select value={form.goal} onChange={(event) => setForm({ ...form, goal: event.target.value })}><option value="LOSE_WEIGHT">Giảm cân</option><option value="MAINTAIN">Duy trì vóc dáng</option><option value="GAIN_WEIGHT">Tăng cân</option><option value="BUILD_MUSCLE">Tăng cơ</option></select></label>
            <label>Kiểu ăn<select value={form.dietType} onChange={(event) => setForm({ ...form, dietType: event.target.value })}><option value="BALANCED">Cân bằng</option><option value="VEGETARIAN">Ăn chay</option><option value="VEGAN">Thuần chay</option><option value="LOW_CARB">Ít tinh bột</option><option value="HIGH_PROTEIN">Giàu protein</option></select></label>
            <label>Số bữa mỗi ngày<select value={form.mealsPerDay} onChange={(event) => setForm({ ...form, mealsPerDay: event.target.value })}><option value="3">3 bữa chính</option><option value="4">3 bữa chính + 1 bữa phụ</option></select></label>
            <label>Nền ẩm thực yêu thích<input value={form.preferredCuisines} onChange={(event) => setForm({ ...form, preferredCuisines: event.target.value })} placeholder="Việt Nam, Nhật Bản" /><small>Ngăn cách nhiều lựa chọn bằng dấu phẩy.</small></label>
            <label className="profile-field-wide">Dị ứng thực phẩm<div className="profile-warning-input"><AlertTriangle /><input value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} placeholder="Ví dụ: đậu phộng, tôm, sữa" /></div><small>Thông tin quan trọng để AI loại bỏ món không an toàn.</small></label>
            <label className="profile-field-wide">Thực phẩm không thích<input value={form.dislikedFoods} onChange={(event) => setForm({ ...form, dislikedFoods: event.target.value })} placeholder="Ví dụ: cần tây, hành sống" /></label>
          </div>
        </section>

        {error && <div className="form-error profile-form-message">{error}</div>}
        {success && <div className="form-success profile-form-message"><Check /> Đã lưu hồ sơ và tính lại mục tiêu dinh dưỡng.</div>}
        <div className="profile-form-actions"><span><ShieldCheck /> Dữ liệu chỉ được sử dụng để cá nhân hóa trải nghiệm của bạn.</span><button className="button profile-save-bottom" disabled={save.isPending}><Save />{save.isPending ? "Đang lưu..." : "Lưu hồ sơ"}</button></div>
      </form>

      <aside className="professional-profile-side">
        <section className="profile-target-card">
          <header><span><Calculator /></span><div><small>Mục tiêu mỗi ngày</small><h2>Năng lượng đề xuất</h2></div></header>
          <div className={`profile-calorie-ring ${calories ? "" : "empty"}`}><div><strong>{calories || "—"}</strong><span>kcal / ngày</span></div></div>
          <p>Được tính theo công thức Mifflin–St Jeor và mức vận động của bạn.</p>
          <div className="profile-macros">
            <div><header><span><i className="protein" />Protein</span><b>{protein || "—"}g</b></header><div><span className="protein" style={{ width: `${protein ? Math.max(18, protein / maxMacro * 100) : 0}%` }} /></div></div>
            <div><header><span><i className="carbs" />Tinh bột</span><b>{carbs || "—"}g</b></header><div><span className="carbs" style={{ width: `${carbs ? Math.max(18, carbs / maxMacro * 100) : 0}%` }} /></div></div>
            <div><header><span><i className="fat" />Chất béo</span><b>{fat || "—"}g</b></header><div><span className="fat" style={{ width: `${fat ? Math.max(18, fat / maxMacro * 100) : 0}%` }} /></div></div>
          </div>
          <small className="profile-disclaimer">Các chỉ số mang tính tham khảo, không thay thế tư vấn y khoa.</small>
        </section>

        <section className="profile-health-card">
          <header><div><span>Chỉ số BMI</span><h2>{bmi ? bmi.toFixed(1) : "—"}</h2></div><span className={bmi && bmi >= 18.5 && bmi < 25 ? "good" : ""}><HeartPulse /></span></header>
          <div className="bmi-scale"><span />{bmi && <i style={{ left: `${Math.min(96, Math.max(4, (bmi - 14) / 26 * 100))}%` }} />}</div>
          <footer><span>{bmiCopy}</span><b>{weightDifference === null ? "Chưa có mục tiêu" : weightDifference === 0 ? "Đã đạt mục tiêu" : `${weightDifference > 0 ? "+" : ""}${weightDifference.toFixed(1)} kg tới mục tiêu`}</b></footer>
        </section>

        <section className="profile-ai-card">
          <span><Sparkles /></span><div><small>NutriPlan AI</small><h2>Hồ sơ càng đầy đủ, gợi ý càng chính xác</h2><p>AI dùng mục tiêu, khẩu vị và dị ứng để xây dựng thực đơn riêng cho bạn.</p><Link to="/assistant">Trò chuyện với AI <ChevronRight /></Link></div>
        </section>
      </aside>
    </div>
  </div>;
}
