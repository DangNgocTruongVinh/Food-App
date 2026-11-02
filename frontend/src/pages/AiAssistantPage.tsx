import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getApiError } from "../api/client";
import { ASSISTANT_INPUT_ID, AssistantChat } from "../components/assistant/AssistantChat";
import { AssistantContextCard, AssistantHistoryCard, AssistantSuggestionsCard } from "../components/assistant/AssistantSide";
import { ErrorState, LoadingState, Skeleton } from "../components/ui";
import {
  assistantPromptSuggestions, normalizeChatMessage, RECENT_HISTORY_LIMIT, recentUserHistory, scrollChatToLatest,
} from "../features/ai/ai.logic";
import { aiMutations, aiQueries, invalidateAIHistory } from "../features/ai/ai.queries";
import { profileQueries } from "../features/profile/profile.queries";

export default function AiAssistantPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userHasSent = useRef(false);

  const history = useQuery(aiQueries.history());
  const data = history.data ?? [];
  const { data: dashboard } = useQuery(aiQueries.dashboard());
  const { data: profileData } = useQuery(profileQueries.detail());
  const { data: aiStatus } = useQuery(aiQueries.status());
  const chat = useMutation({
    ...aiMutations.chat(),
    onSuccess: () => { setMessage(""); setError(""); invalidateAIHistory(queryClient); },
    onError: (err) => setError(getApiError(err)),
  });

  // Vào trang chỉ cuộn bên trong khung chat; sau khi gửi mới kéo cả trang tới câu trả lời (sửa ở GĐ2c).
  useEffect(() => scrollChatToLatest(windowRef.current, bottomRef.current, userHasSent.current), [data, chat.isPending]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = normalizeChatMessage(message);
    if (!content || chat.isPending) return;
    userHasSent.current = true;
    chat.mutate(content);
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
        <h1 className="ui-title">Hỏi <em>Nouri</em></h1>
        <p className="ui-text">Hỏi về bữa ăn, dinh dưỡng hoặc cách dùng thực phẩm trong kho của bạn.</p>
      </header>
      {aiStatus && !aiStatus.available && (
        <p className="ui-notice" role="status">
          Chưa cấu hình OpenAI: trợ lý đang dùng câu trả lời mẫu (cùng một câu cho mọi câu hỏi),
          chưa đọc câu hỏi, hồ sơ hay kho.
        </p>
      )}

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
            value={message}
            onChange={setMessage}
            onSubmit={submit}
            suggestions={suggestions}
            onPickSuggestion={pickSuggestion}
            windowRef={windowRef}
            bottomRef={bottomRef}
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
