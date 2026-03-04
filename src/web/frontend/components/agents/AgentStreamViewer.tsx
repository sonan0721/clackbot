import { useRef, useEffect } from 'react';
import { useSessionStream } from '@/context/AgentStreamContext';
import { StreamingIndicator } from '@/components/chat/StreamingIndicator';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Radio } from 'lucide-react';
import type { AgentSessionSummary } from '@/types/api';

interface AgentStreamViewerProps {
  session: AgentSessionSummary;
}

export function AgentStreamViewer({ session }: AgentStreamViewerProps) {
  const stream = useSessionStream(session.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stream?.tokens, stream?.thinking.length, stream?.tools.length]);

  const isStreaming = !!stream && !stream.completed;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{session.agentType}</h3>
            {isStreaming && (
              <Badge variant="default" className="bg-green-600 text-[10px] px-1.5">
                <Radio className="mr-1 h-2.5 w-2.5 animate-pulse" />
                LIVE
              </Badge>
            )}
          </div>
          {session.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{session.description}</p>
          )}
        </div>
      </div>

      {/* 스트리밍 콘텐츠 */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3 max-w-2xl">
          {!stream ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {session.status === 'active'
                ? '스트리밍 대기 중...'
                : '이 세션은 종료되었습니다.'}
            </div>
          ) : (
            <>
              {/* 스트리밍 중인 토큰 */}
              {!stream.completed && stream.tokens && (
                <StreamingIndicator text={stream.tokens} />
              )}

              {/* Thinking + Tools */}
              {!stream.completed && (
                <ThinkingPanel thinking={stream.thinking} tools={stream.tools} />
              )}

              {/* 완료된 응답 */}
              {stream.completed && stream.finalText && (
                <ChatMessage role="assistant" text={stream.finalText} />
              )}
            </>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
