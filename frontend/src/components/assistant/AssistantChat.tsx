import { Send } from "lucide-react";
import { type FormEvent, type RefObject } from "react";
import { allergyWarningText, chatMessageTime, isSubmitEnter } from "../../features/ai/ai.logic";
import type { ChatMessage } from "../../types";
import { Button, ErrorState } from "../ui";
import { AssistantUnavailable } from "./AssistantUnavailable";

export const ASSISTANT_INPUT_ID = "assistant-question";

type AssistantChatProps = {
  messages: ChatMessage[];
  pending: boolean;
  /** Câu hỏi đang gửi (hiện ngay trong khung chat khi chờ trả lời). */
  pendingQuestion: string | null;
  error: string;
  /** Trợ lý không dùng được (chưa có key / OpenAI lỗi): báo trong khung chat kèm liên kết, khóa nút gửi khi chưa có key. */
  unavailable: { message: string; blocking: boolean } | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  suggestions: string[];
  onPickSuggestion: (text: string) => void;
  /** Khung danh sách tin nhắn (trang tự cuộn khung này, không cuộn cả trang). */
  windowRef: RefObject<HTMLDivElement | null>;
  /** Người dùng cuộn khung: trang ghi nhận có đang ở gần cuối không. */
  onScroll: () => void;
};

function Message({ role, content, createdAt, allergyWarnings }: Pick<ChatMessage, "role" | "content" | "allergyWarnings"> & { createdAt?: string }) {
  const mine = role === "user";
  const warning = mine ? null : allergyWarningText(allergyWarnings);
  return (
    <li className={mine ? "as-msg as-msg--user" : "as-msg as-msg--assistant"}>
      <p className="as-msg__bubble"><span className="ui-visually-hidden">{mine ? "Bạn: " : "Nouri: "}</span>{content}</p>
      {warning && <p className="ui-notice ui-notice--error as-msg__warning" role="note"><span>{warning}</span></p>}
      {createdAt && <time className="as-msg__time" dateTime={createdAt}>{chatMessageTime(createdAt)}</time>}
    </li>
  );
}

/** Khung chat: tin của bạn căn phải (--surface-2), của trợ lý căn trái (--surface, viền); ô nhập cố định dưới khung. */
export function AssistantChat(props: AssistantChatProps) {
  const { messages, pending, pendingQuestion, value, onChange, onSubmit } = props;
  const empty = !messages.length && !pending;
  return (
    <section className="as-chat" aria-labelledby="as-chat-title">
      <h2 id="as-chat-title" className="ui-visually-hidden">Trò chuyện với trợ lý</h2>
      <div className="as-chat__window" ref={props.windowRef} onScroll={props.onScroll} tabIndex={0} role="region" aria-label="Lịch sử trò chuyện">
        {empty ? (
          <div className="as-chat__empty">
            <p className="as-chat__empty-text">Chưa có câu hỏi nào. Chọn một câu gợi ý hoặc tự gõ câu hỏi bên dưới.</p>
            <ul className="as-prompts">
              {props.suggestions.map((text) => (
                <li key={text}><button type="button" className="as-prompt" onClick={() => props.onPickSuggestion(text)}>{text}</button></li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="as-chat__list" aria-label="Tin nhắn">
            {messages.map((item) => (
              <Message key={item.id} role={item.role} content={item.content} createdAt={item.createdAt} allergyWarnings={item.allergyWarnings} />
            ))}
            {pending && pendingQuestion && <Message role="user" content={pendingQuestion} />}
            {pending && (
              <li className="as-msg as-msg--assistant" role="status">
                <p className="as-msg__bubble as-msg__bubble--pending">Nouri đang trả lời…</p>
              </li>
            )}
          </ol>
        )}
      </div>
      {props.unavailable && <div className="as-chat__error"><AssistantUnavailable message={props.unavailable.message} /></div>}
      {props.error && <div className="as-chat__error"><ErrorState message={props.error} /></div>}
      <form className="as-composer" onSubmit={onSubmit}>
        <label className="ui-visually-hidden" htmlFor={ASSISTANT_INPUT_ID}>Câu hỏi cho trợ lý</label>
        <textarea
          id={ASSISTANT_INPUT_ID}
          className="ui-input as-composer__input"
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Hỏi về bữa ăn, dinh dưỡng hoặc thực phẩm trong kho"
          aria-describedby="as-composer-hint as-composer-allergy"
          onKeyDown={(event) => {
            if (!isSubmitEnter({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode })) return;
            event.preventDefault();
            if (!pending) event.currentTarget.form?.requestSubmit();
          }}
        />
        <Button type="submit" variant="primary" icon={<Send />} disabled={!value.trim() || props.unavailable?.blocking} busy={pending}>Gửi</Button>
        <p id="as-composer-hint" className="as-composer__hint">
          Enter để gửi, Shift + Enter để xuống dòng. Trợ lý có thể sai, không thay thế tư vấn của bác sĩ.
        </p>
        {/* GĐ3b-R2: AI đã được dặn tránh món vi phạm hồ sơ (R1) nhưng vẫn có thể sai, người dùng tự kiểm lại. */}
        <p id="as-composer-allergy" className="as-composer__hint">
          Gợi ý của AI chỉ để tham khảo, hãy kiểm tra thành phần nếu bạn bị dị ứng.
        </p>
      </form>
    </section>
  );
}
