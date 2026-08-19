import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, CalendarDays, Check, ChefHat, ChevronDown, Flame, Heart, History, Lightbulb, Mic, PackageOpen, Paperclip, Send, Sparkles, Target, UserRound, Utensils } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, getApiError } from "../api/client";
import { LoadingState } from "../components/States";
import type { ChatMessage, DashboardData, ProfileResponse } from "../types";

const suggestions = ["Gợi ý bữa tối từ thực phẩm sắp hết hạn", "Làm sao để đạt đủ protein hôm nay?", "Tôi nên chuẩn bị gì cho bữa sáng nhanh?"];

const dietLabels: Record<string, string> = {
  BALANCED: "Ăn cân bằng",
  VEGETARIAN: "Ăn chay",
  VEGAN: "Thuần chay",
  LOW_CARB: "Low Carb",
  HIGH_PROTEIN: "Giàu protein",
};

export default function AiAssistantPage() {
  const queryClient = useQueryClient(); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const bottomRef = useRef<HTMLDivElement>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["chat-history"], queryFn: async () => (await api.get<ChatMessage[]>("/ai/history")).data });
  const { data: dashboard } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get<DashboardData>("/dashboard")).data });
  const { data: profileData } = useQuery({ queryKey: ["profile"], queryFn: async () => (await api.get<ProfileResponse>("/profile")).data });
  const chat = useMutation({ mutationFn: async (content: string) => (await api.post<{ answer: string }>("/ai/chat", { message: content })).data, onSuccess: () => { setMessage(""); setError(""); queryClient.invalidateQueries({ queryKey: ["chat-history"] }); }, onError: (err) => setError(getApiError(err)) });
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [data, chat.isPending]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (message.trim()) chat.mutate(message.trim()); };
  if (isLoading) return <LoadingState />;
  const profile = profileData?.profile;
  const quickActions = [
    { title: "Gợi ý bữa ăn", copy: "Theo mục tiêu dinh dưỡng của bạn", prompt: "Gợi ý bữa ăn phù hợp với mục tiêu dinh dưỡng hôm nay", icon: <Utensils />, tone: "meal" },
    { title: "Lập thực đơn", copy: "Kế hoạch 1–7 ngày phù hợp thể trạng", prompt: "Hãy lập cho tôi một thực đơn lành mạnh trong 7 ngày", icon: <CalendarDays />, tone: "plan" },
    { title: "Nấu từ thực phẩm trong kho", copy: "Tận dụng nguyên liệu sẵn có", prompt: "Gợi ý món ăn từ thực phẩm hiện có trong kho của tôi", icon: <PackageOpen />, tone: "pantry" },
    { title: "Gợi ý công thức", copy: "Món ngon, lành mạnh và dễ làm", prompt: "Gợi ý cho tôi một công thức lành mạnh và dễ làm", icon: <ChefHat />, tone: "recipe" },
  ];
  const fallbackHistory = ["Gợi ý bữa tối giàu protein", "Thực đơn giảm cân 3 ngày", "Dùng thực phẩm trong kho", "Giá trị dinh dưỡng của ức gà"];
  const historyItems = data.filter((item) => item.role === "user").slice(-4).reverse().map((item) => item.content);

  return <div className="assistant-page assistant-dashboard-page">
    <header className="assistant-header assistant-dashboard-hero">
      <div><span className="online"><i /> Đang hoạt động</span><h1>Trợ lý dinh dưỡng AI</h1><p>Hiểu thói quen, mục tiêu và thực phẩm của bạn để đưa ra gợi ý phù hợp nhất.</p></div>
      <img src="/assets/ai-mascot.png" alt="Robot đầu bếp NOURI AI" />
      <div className="assistant-hero-foods" aria-hidden="true"><span className="avocado">🥑</span><span className="tomato">🍅</span><span className="greens">🥬</span></div>
    </header>

    <section className="assistant-context-bar" aria-label="Thông tin cá nhân hóa cho trợ lý">
      <div><span><PackageOpen /></span><b>{dashboard?.pantryCount ?? "—"}</b><small>thực phẩm trong kho</small></div>
      <div><span><Flame /></span><b>{profile?.dailyCalorieTarget ?? dashboard?.nutritionTargets?.calories ?? "—"} kcal/ngày</b><small>mức năng lượng</small></div>
      <div><span><Target /></span><b>{dietLabels[profile?.dietType ?? ""] ?? "Ăn lành mạnh"}</b><small>mục tiêu</small></div>
      <div><span><CalendarDays /></span><b>{dashboard?.todayMeals.length ? `${dashboard.todayMeals.length} bữa` : "Chưa có"}</b><small>kế hoạch hôm nay</small></div>
      <button onClick={() => setMessage(suggestions[0])}><Sparkles /> Gợi ý nhanh <ChevronDown /></button>
    </section>

    <div className="assistant-workspace">
      <main className="assistant-conversation-column">
        <section className="assistant-chat-shell">
          <div className="chat-window">
            {!data.length && <section className="chat-welcome assistant-welcome-dashboard">
              <div className="assistant-welcome-mascot"><span><Heart /></span><img src="/assets/ai-mascot.png" alt="" /></div>
              <span className="assistant-welcome-hello">Xin chào! 👋</span>
              <h2>Hôm nay mình có thể giúp gì cho bạn?</h2>
              <p>Hãy hỏi về dinh dưỡng, thực đơn, công thức hoặc sử dụng thực phẩm trong kho.</p>
              <div className="assistant-action-grid">{quickActions.map((action) => <button className={action.tone} key={action.title} onClick={() => setMessage(action.prompt)}><span>{action.icon}</span><strong>{action.title}</strong><small>{action.copy}</small><i><ArrowRight /></i></button>)}</div>
              <div className="assistant-prompt-divider"><span>Hoặc thử hỏi</span></div>
              <div className="assistant-prompt-pills">{["Món dưới 30 phút", "Món ít calo", "Tăng cơ, nhiều protein", "Ăn chay", "Giảm cân"].map((text) => <button key={text} onClick={() => setMessage(text)}>{text}</button>)}</div>
            </section>}
            {data.map((item) => <div className={`message ${item.role}`} key={item.id}><span>{item.role === "assistant" ? <Bot /> : <UserRound />}</span><div>{item.content}</div></div>)}
            {chat.isPending && <div className="message assistant"><span><Bot /></span><div className="typing"><i /><i /><i /></div></div>}<div ref={bottomRef} />
          </div>
        </section>

        {error && <div className="form-error">{error}</div>}
        <form className="chat-input" onSubmit={submit}><span className="assistant-input-mark"><Sparkles /></span><div className="assistant-composer"><textarea rows={1} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Hỏi về bữa ăn, dinh dưỡng hoặc nguyên liệu..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><div><button type="button"><Paperclip /> Đính kèm thực phẩm</button><button type="button"><Mic /> Giọng nói</button></div></div><button className="assistant-send" aria-label="Gửi câu hỏi" disabled={!message.trim() || chat.isPending}><Send /></button></form>
        <p className="ai-disclaimer">AI có thể mắc lỗi và không thay thế chuyên gia y tế.</p>
      </main>

      <aside className="assistant-insights">
        <section className="assistant-tip-card"><header><Lightbulb /><h2>Mẹo dinh dưỡng hôm nay</h2></header><p>Bổ sung nhiều rau xanh và uống đủ nước giúp cơ thể khỏe mạnh hơn!</p><span className="assistant-tip-visual" aria-hidden="true">🥬</span></section>
        <section className="assistant-features-card"><header><Bot /><h2>Tính năng AI</h2></header><ul><li><Check /> Gợi ý thực đơn thông minh</li><li><Check /> Phân tích dinh dưỡng chi tiết</li><li><Check /> Tư vấn theo mục tiêu cá nhân</li><li><Check /> Tận dụng thực phẩm trong kho</li><li><Check /> Nhắc nhở thói quen lành mạnh</li></ul></section>
        <section className="assistant-history-card"><header><div><History /><h2>Lịch sử trò chuyện</h2></div><button>Xem tất cả</button></header><ul>{(historyItems.length ? historyItems : fallbackHistory).map((item, index) => <li key={`${item}-${index}`}><span>{item}</span><time>{index === 0 ? "10:23" : index === 1 ? "Hôm qua" : `${index} ngày trước`}</time></li>)}</ul></section>
      </aside>
    </div>
  </div>;
}
