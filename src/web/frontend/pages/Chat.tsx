import { useRef, useEffect } from 'react';
import { useChatStream } from '@/hooks/useChatStream';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { StreamingIndicator } from '@/components/chat/StreamingIndicator';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Chat() {
  const { streams, connected } = useChatStream();
  const scrollRef = useRef<HTMLDivElement>(null);

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

      {/* 채팅 입력 -- Phase 5에서 활성화 */}
      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <input
            type="text"
            placeholder="Phase 5에서 활성화됩니다..."
            disabled
            className="w-full rounded-lg border px-4 py-2 text-sm bg-muted text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
