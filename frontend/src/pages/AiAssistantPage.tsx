import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, getApiError } from "../api/client";
import { LoadingState } from "../components/States";
import type { ChatMessage } from "../types";

const suggestions = ["Gợi ý bữa tối từ thực phẩm sắp hết hạn", "Làm sao để đạt đủ protein hôm nay?", "Tôi nên chuẩn bị gì cho bữa sáng nhanh?"];

export default function AiAssistantPage() {
  const queryClient = useQueryClient(); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const bottomRef = useRef<HTMLDivElement>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["chat-history"], queryFn: async () => (await api.get<ChatMessage[]>("/ai/history")).data });
  const chat = useMutation({ mutationFn: async (content: string) => (await api.post<{ answer: string }>("/ai/chat", { message: content })).data, onSuccess: () => { setMessage(""); setError(""); queryClient.invalidateQueries({ queryKey: ["chat-history"] }); }, onError: (err) => setError(getApiError(err)) });
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [data, chat.isPending]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (message.trim()) chat.mutate(message.trim()); };
  if (isLoading) return <LoadingState />;
  return <div className="assistant-page"><header className="assistant-header"><div className="assistant-avatar"><Bot /></div><div><span className="online"><i /> Đang hoạt động</span><h1>Trợ lý dinh dưỡng AI</h1><p>Hiểu hồ sơ, mục tiêu và kho thực phẩm của riêng bạn.</p></div></header><div className="chat-window">
    {!data.length && <section className="chat-welcome"><span><Sparkles /></span><h2>Hôm nay bạn muốn ăn gì?</h2><p>Mình có thể gợi ý món, giải thích dinh dưỡng và giúp bạn tận dụng nguyên liệu.</p><div>{suggestions.map((text) => <button key={text} onClick={() => setMessage(text)}>{text}</button>)}</div></section>}
    {data.map((item) => <div className={`message ${item.role}`} key={item.id}><span>{item.role === "assistant" ? <Bot /> : <UserRound />}</span><div>{item.content}</div></div>)}
    {chat.isPending && <div className="message assistant"><span><Bot /></span><div className="typing"><i /><i /><i /></div></div>}<div ref={bottomRef} />
  </div>{error && <div className="form-error">{error}</div>}<form className="chat-input" onSubmit={submit}><textarea rows={1} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hỏi về bữa ăn, dinh dưỡng hoặc nguyên liệu..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} /><button aria-label="Gửi câu hỏi" disabled={!message.trim() || chat.isPending}><Send /></button></form><p className="ai-disclaimer">AI có thể mắc lỗi và không thay thế chuyên gia y tế.</p></div>;
}
