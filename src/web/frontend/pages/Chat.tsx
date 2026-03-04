import { useRef, useEffect, useState, useCallback } from 'react';
import { useAgentStreams, useAgentEvent } from '@/context/AgentStreamContext';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { StreamingIndicator } from '@/components/chat/StreamingIndicator';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatEntry {
  id: string;
  type: 'user' | 'assistant-stream' | 'assistant-complete';
  text: string;
  source?: 'slack' | 'web';
  sessionId?: string;
  timestamp: number;
}

export default function Chat() {
  const { streams, connected, send } = useAgentStreams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);

  // 사용자 메시지 수신 (Slack/Web 모두)
  useAgentEvent('message:incoming', useCallback((data: any) => {
    const msg = data.message;
    const text = typeof msg?.text === 'string' ? msg.text : String(msg?.text ?? '');
    if (!text) return;
    setEntries(prev => {
      // 중복 방지
      if (prev.some(e => e.id === msg.id)) return prev;
      return [...prev, {
        id: msg.id || `in-${Date.now()}`,
        type: 'user' as const,
        text,
        source: data.source || msg.source,
        timestamp: Date.now(),
      }];
    });
  }, []));

  // 봇 응답 완료 수신
  useAgentEvent('agent:complete', useCallback((data: any) => {
    const resultText = data.result?.text;
    const text = typeof resultText === 'string' ? resultText : String(resultText ?? '');
    if (!text) return;
    setEntries(prev => {
      // 같은 sessionId로 이미 완료 항목이 있으면 스킵
      if (prev.some(e => e.sessionId === data.sessionId && e.type === 'assistant-complete')) return prev;
      return [...prev, {
        id: `complete-${data.sessionId}`,
        type: 'assistant-complete' as const,
        text,
        sessionId: data.sessionId,
        timestamp: Date.now(),
      }];
    });
  }, []));

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    // 로컬에 즉시 표시
    setEntries(prev => [...prev, {
      id: `web-${Date.now()}`,
      type: 'user',
      text: input.trim(),
      source: 'web',
      timestamp: Date.now(),
    }]);
    send({ type: 'chat:send', text: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 새 항목 시 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, streams]);

  // 현재 활성 스트리밍 세션 (완료 안 된 것)
  const activeStreams = Array.from(streams.entries()).filter(
    ([, s]) => !s.completed && (s.tokens || s.thinking.length > 0 || s.tools.length > 0)
  );

  const isEmpty = entries.length === 0 && activeStreams.length === 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="실시간 채팅"
        description="Slack 양방향 미러링 + 실시간 스트리밍"
        actions={
          <Badge variant={connected ? 'default' : 'destructive'}>
            {connected ? '연결됨' : '연결 끊김'}
          </Badge>
        }
      />

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-3xl mx-auto">
          {isEmpty && (
            <p className="text-center text-muted-foreground py-20">
              Slack에서 봇에게 메시지를 보내거나 아래에서 직접 입력하세요
            </p>
          )}

          {/* 타임라인: 사용자 메시지 + 완료된 봇 응답 */}
          {entries.map((entry) => (
            <div key={entry.id}>
              {entry.type === 'user' ? (
                <div className="flex items-start gap-2 flex-row-reverse">
                  <ChatMessage role="user" text={entry.text} />
                  {entry.source && (
                    <Badge variant="outline" className="mt-2 text-[10px] shrink-0">
                      {entry.source === 'slack' ? 'Slack' : 'Web'}
                    </Badge>
                  )}
                </div>
              ) : (
                <ChatMessage role="assistant" text={entry.text} />
              )}
            </div>
          ))}

          {/* 활성 스트리밍 (진행 중인 응답) */}
          {activeStreams.map(([sessionId, stream]) => (
            <div key={sessionId} className="space-y-3">
              {stream.tokens && (
                <StreamingIndicator text={stream.tokens} />
              )}
              <ThinkingPanel thinking={stream.thinking} tools={stream.tools} />
            </div>
          ))}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* 채팅 입력 */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? '메시지를 입력하세요...' : '연결 중...'}
            disabled={!connected}
            className="flex-1 rounded-lg border px-4 py-2 text-sm bg-background"
          />
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
