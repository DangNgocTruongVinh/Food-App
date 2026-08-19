import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Sparkles } from "lucide-react";
import Logo from "../components/Logo";
import { getApiError } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [registerMode, setRegisterMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = useAuth();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { registerMode ? await auth.register(form.name, form.email, form.password) : await auth.login(form.email, form.password); }
    catch (err) { setError(getApiError(err)); } finally { setLoading(false); }
  };
  return <main className="auth-page">
    <section className="auth-story">
      <Logo />
      <div><span className="eyebrow"><Sparkles size={15} /> Dinh dưỡng thông minh mỗi ngày</span><h1>Ăn ngon hơn.<br />Sống khỏe hơn.</h1><p>Biến những gì đang có trong tủ lạnh thành thực đơn cân bằng, đúng khẩu vị và không lãng phí.</p>
        <ul><li><CheckCircle2 /> Ưu tiên thực phẩm sắp hết hạn</li><li><CheckCircle2 /> Cá nhân hoá mục tiêu dinh dưỡng</li><li><CheckCircle2 /> Lập thực đơn 7 ngày bằng AI</li></ul>
      </div><blockquote>“You are what you eat.”</blockquote>
    </section>
    <section className="auth-panel"><form className="auth-card" onSubmit={submit}><div className="auth-mobile-logo"><Logo /></div><span className="eyebrow">{registerMode ? "Bắt đầu hành trình" : "Chào mừng trở lại"}</span><h2>{registerMode ? "Tạo tài khoản" : "Đăng nhập"}</h2><p>{registerMode ? "Thiết lập hồ sơ dinh dưỡng chỉ trong vài phút." : "Tiếp tục kế hoạch ăn uống của bạn."}</p>
      {registerMode && <label>Họ và tên<input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Minh Anh" /></label>}
      <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ban@example.com" /></label>
      <label>Mật khẩu<div className="password-field"><input required type={showPassword ? "text" : "password"} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 8 ký tự" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
      {error && <div className="form-error">{error}</div>}
      <button className="button primary wide" disabled={loading}>{loading ? "Đang xử lý..." : registerMode ? "Tạo tài khoản" : "Đăng nhập"}<ArrowRight size={18} /></button>
      <p className="auth-switch">{registerMode ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button type="button" onClick={() => { setRegisterMode(!registerMode); setError(""); }}>{registerMode ? "Đăng nhập" : "Đăng ký miễn phí"}</button></p>
    </form></section>
  </main>;
}
