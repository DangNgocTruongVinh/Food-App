import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getApiError } from "../api/client";
import { ASSISTANT_INPUT_ID, AssistantChat } from "../components/assistant/AssistantChat";
import { AssistantContextCard, AssistantHistoryCard, AssistantSuggestionsCard } from "../components/assistant/AssistantSide";
import { ErrorState, LoadingState, Skeleton } from "../components/ui";
import {
  AI_NOT_CONFIGURED_TEXT, assistantPromptSuggestions, chatErrorKind, isNearChatBottom, normalizeChatMessage, RECENT_HISTORY_LIMIT,
  recentUserHistory, scrollChatToBottom,
} from "../features/ai/ai.logic";
import { aiMutations, aiQueries, invalidateAIHistory } from "../features/ai/ai.queries";
import { profileQueries } from "../features/profile/profile.queries";

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // OpenAI lỗi khi gửi (503): báo trong khung chat kèm liên kết "Gợi ý cho bạn" / "Nấu gì từ kho?".
  const [serviceError, setServiceError] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  // Người dùng đang ở gần cuối khung tin nhắn: tin mới tới thì tự cuộn theo; đã cuộn lên đọc tin cũ thì để yên.
  const stickToBottom = useRef(true);
  const scrolledOnce = useRef(false);

  const history = useQuery(aiQueries.history());
  const data = history.data ?? [];
  const { data: dashboard } = useQuery(aiQueries.dashboard());
  const { data: profileData } = useQuery(profileQueries.detail());
  const { data: aiStatus } = useQuery(aiQueries.status());
  // onSuccess trả Promise: "đang trả lời" giữ tới khi lịch sử tải lại xong, tin vừa gửi không nháy mất.
  const chat = useMutation({ ...aiMutations.chat(), onSuccess: () => invalidateAIHistory(queryClient) });

  // Chỉ cuộn khung tin nhắn (scrollTop của khung), không cuộn trang; lần đầu vào trang nhảy thẳng tới tin mới nhất.
  useEffect(() => {
    if (!windowRef.current || !stickToBottom.current) return;
    scrollChatToBottom(windowRef.current, scrolledOnce.current);
    scrolledOnce.current = true;
  }, [data.length, chat.isPending]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = normalizeChatMessage(message);
    if (!content || chat.isPending) return;
    stickToBottom.current = isNearChatBottom(windowRef.current);
    // Xóa ô nhập ngay; tin hiện trong khung kèm "Nouri đang trả lời…". Gửi lỗi thì trả lại nội dung (nếu ô vẫn trống).
    setMessage("");
    setError("");
    setServiceError("");
    chat.mutate(content, {
      onError: (err) => {
        setMessage((current) => current || content);
        const response = axios.isAxiosError(err) ? err.response : undefined;
        const kind = chatErrorKind(response?.status, (response?.data as { details?: { code?: unknown } } | undefined)?.details?.code);
        if (kind === "unavailable") setServiceError(getApiError(err));
        else setError(kind === "limit" ? getApiError(err) : `Chưa gửi được câu hỏi: ${getApiError(err)}`);
      },
    });
  };
  const pickSuggestion = (text: string) => {
    setMessage(text);
    document.getElementById(ASSISTANT_INPUT_ID)?.focus();
  };

  const profile = profileData?.profile;
  const suggestions = assistantPromptSuggestions({ profile, dashboard });
  const historyItems = recentUserHistory(data, showAllHistory ? null : RECENT_HISTORY_LIMIT);

  return (
    <div className="as-view">
      <header className="as-hero">
        <h1 className="ui-title">Hỏi Nouri</h1>
        <p className="ui-text">Hỏi về bữa ăn, dinh dưỡng hoặc cách dùng thực phẩm trong kho của bạn.</p>
      </header>

      <div className="as-layout">
        {history.isLoading ? (
          <LoadingState label="Đang tải cuộc trò chuyện"><Skeleton kind="block" className="as-chat as-chat--loading" /></LoadingState>
        ) : history.isError ? (
          <ErrorState message="Chưa tải được lịch sử trò chuyện." onRetry={() => void history.refetch()} retrying={history.isFetching} />
        ) : (
          <AssistantChat
            messages={data}
            pending={chat.isPending}
            pendingQuestion={chat.isPending ? chat.variables ?? null : null}
            error={error}
            unavailable={aiStatus && !aiStatus.available ? { message: AI_NOT_CONFIGURED_TEXT, blocking: true }
              : serviceError ? { message: serviceError, blocking: false } : null}
            value={message}
            onChange={setMessage}
            onSubmit={submit}
            suggestions={suggestions}
            onPickSuggestion={pickSuggestion}
            windowRef={windowRef}
            onScroll={() => { stickToBottom.current = isNearChatBottom(windowRef.current); }}
          />
        )}

        <aside className="as-side" aria-label="Ngữ cảnh và gợi ý">
          <AssistantContextCard profile={profile} dashboard={dashboard} />
          {data.length > 0 && <AssistantSuggestionsCard suggestions={suggestions} onPick={pickSuggestion} />}
          <AssistantHistoryCard
            items={historyItems}
            expanded={showAllHistory}
            hasMore={recentUserHistory(data, null).length > RECENT_HISTORY_LIMIT}
            onToggle={() => setShowAllHistory((value) => !value)}
          />
        </aside>
      </div>
    </div>
  );
}
