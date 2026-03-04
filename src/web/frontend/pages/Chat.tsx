import { useRef, useEffect, useState } from 'react';
import { useChatStream } from '@/hooks/useChatStream';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { StreamingIndicator } from '@/components/chat/StreamingIndicator';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Chat() {
  const { streams, connected, send } = useChatStream();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || !connected) return;
    send({ type: 'chat:send', text: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streams]);

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
          {streams.size === 0 && (
            <p className="text-center text-muted-foreground py-20">
              Slack에서 봇에게 메시지를 보내면 여기에 실시간으로 표시됩니다.
            </p>
          )}

          {Array.from(streams.entries()).map(([sessionId, stream]) => (
            <div key={sessionId} className="space-y-3">
              {/* 스트리밍 중인 토큰 */}
              {!stream.completed && stream.tokens && (
                <StreamingIndicator text={stream.tokens} />
              )}

              {/* Thinking + Tools 패널 */}
              {!stream.completed && (
                <ThinkingPanel thinking={stream.thinking} tools={stream.tools} />
              )}

              {/* 완료된 응답 */}
              {stream.completed && stream.finalText && (
                <ChatMessage role="assistant" text={stream.finalText} />
              )}
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
