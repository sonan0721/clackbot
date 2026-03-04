import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ChevronLeft, Bot, User, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApiQuery } from '@/hooks/useApi';
import { useAgentStreams } from '@/context/AgentStreamContext';
import type { ConversationsResponse, Message } from '@/types/api';

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

interface MessagesResponse {
  messages: Message[];
}

export default function Conversations() {
  const { name } = useParams<{ name: string }>();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const { connected, send } = useAgentStreams();
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // 검색어 debounce
  const handleSearchChange = (value: string) => {
    setSearch(value);
    // 간단한 debounce: setTimeout
    clearTimeout((window as Record<string, ReturnType<typeof setTimeout>>).__convSearchTimeout);
    (window as Record<string, ReturnType<typeof setTimeout>>).__convSearchTimeout = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
  };

  const offset = page * PAGE_SIZE;
  const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
  const projectParam = name ? `&project=${encodeURIComponent(name)}` : '';

  const { data, isLoading } = useApiQuery<ConversationsResponse>(
    ['conversations', String(page), debouncedSearch, name ?? ''],
    `/api/conversations?limit=${PAGE_SIZE}&offset=${offset}${searchParam}${projectParam}`,
    { staleTime: 5_000 },
  );

  const { data: threadData, isLoading: threadLoading } = useApiQuery<MessagesResponse>(
    ['conversation-thread', selectedThread ?? ''],
    `/api/conversations/${encodeURIComponent(selectedThread ?? '')}`,
    { enabled: !!selectedThread, staleTime: 5_000 },
  );

  const sessions = data?.sessions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const messages = threadData?.messages ?? [];

  const handleChatSend = () => {
    if (!chatInput.trim() || !connected || !selectedThread) return;
    send({ type: 'chat:send', text: chatInput.trim(), threadTs: selectedThread });
    setChatInput('');
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  // 메시지 변경 시 자동 스크롤
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 채팅 상세 보기
  if (selectedThread) {
    return (
      <>
        <PageHeader
          title="대화 이력"
          description={name ? `프로젝트: ${name}` : undefined}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedThread(null); setChatInput(''); }}
            >
              <ChevronLeft className="h-4 w-4" />
              목록으로
            </Button>
          }
        />
        <div className="flex flex-col h-[calc(100vh-3.5rem)]">
          <ScrollArea className="flex-1 p-6">
            {threadLoading ? (
              <div className="space-y-4 max-w-2xl mx-auto">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                메시지가 없습니다
              </div>
            ) : (
              <div className="space-y-4 max-w-2xl mx-auto pb-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className="space-y-3">
                    {/* 사용자 메시지 (오른쪽) */}
                    {msg.inputText && (
                      <div className="flex justify-end">
                        <div className="max-w-[75%]">
                          <div className="flex items-center justify-end gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.createdAt)}
                            </span>
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
                            {msg.inputText}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* 봇 응답 (왼쪽) */}
                    {msg.outputText && (
                      <div className="flex justify-start">
                        <div className="max-w-[75%]">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.createdAt)}
                            </span>
                          </div>
                          <div className="rounded-lg bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap">
                            {msg.outputText}
                          </div>
                          {/* 도구 사용 배지 */}
                          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {msg.toolsUsed.map((tool, ti) => (
                                <Badge
                                  key={ti}
                                  variant="secondary"
                                  className="text-xs"
                                >
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatScrollRef} />
              </div>
            )}
          </ScrollArea>

          {/* 채팅 입력 */}
          <div className="border-t p-4">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder={connected ? '이 대화에 메시지 보내기...' : '연결 중...'}
                disabled={!connected}
              />
              <Button
                onClick={handleChatSend}
                disabled={!connected || !chatInput.trim()}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // 대화 목록
  return (
    <>
      <PageHeader
        title="대화 이력"
        description={name ? `프로젝트: ${name}` : undefined}
      />
      <div className="p-6 space-y-4">
        {/* 검색 */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="대화 검색..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 세션 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
            {debouncedSearch ? '검색 결과가 없습니다' : '대화 이력이 없습니다'}
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Card
                key={session.threadTs}
                className="cursor-pointer transition-colors hover:bg-accent/50 animate-in slide-in-from-top-1 fade-in duration-200"
                onClick={() => setSelectedThread(session.threadTs)}
              >
                <CardContent className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {truncate(session.firstMessage)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(session.lastAt || session.lastMessageAt)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="ml-4 shrink-0">
                    {session.messageCount}건
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-4 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
