import { ListTodo, Clock, Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAgentStreams } from '@/context/AgentStreamContext';
import type { AgentSessionSummary } from '@/types/api';

interface SessionListProps {
  sessions: AgentSessionSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const STATUS_BADGE: Record<
  AgentSessionSummary['status'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  active: { label: '활성', variant: 'default' },
  completed: { label: '완료', variant: 'secondary' },
  failed: { label: '실패', variant: 'destructive' },
  expired: { label: '만료', variant: 'outline' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
  const { streams } = useAgentStreams();

  if (sessions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        세션이 없습니다
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-2 pr-3">
        {sessions.map((session) => {
          const statusCfg = STATUS_BADGE[session.status];
          const isSelected = session.id === selectedId;
          const isStreaming = session.status === 'active' && streams.has(session.id);

          return (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session.id)}
              className={cn(
                'w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                isSelected && 'border-primary bg-accent',
                isStreaming && 'border-green-500/50',
              )}
            >
              <div className="flex items-center gap-2">
                {isStreaming && (
                  <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                )}
                <Badge variant={statusCfg.variant} className="text-xs">
                  {statusCfg.label}
                </Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  {session.agentType}
                </span>
              </div>
              {session.description && (
                <p className="mt-1.5 line-clamp-2 text-sm">{session.description}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(session.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <ListTodo className="h-3 w-3" />
                  메시지 {session.messageCount}
                </span>
                {session.toolsUsed.length > 0 && (
                  <span>도구 {session.toolsUsed.length}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
