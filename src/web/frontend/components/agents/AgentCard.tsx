import { Radio, Clock, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentSessionSummary } from '@/types/api';
import type { SessionStream } from '@/context/AgentStreamContext';

interface AgentCardProps {
  session: AgentSessionSummary;
  stream: SessionStream | null;
  isSelected: boolean;
  onClick: () => void;
}

const STATUS_CONFIG: Record<
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

export function AgentCard({ session, stream, isSelected, onClick }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[session.status];
  const isStreaming = !!stream && !stream.completed;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-all hover:bg-accent',
        isSelected && 'border-primary bg-accent ring-1 ring-primary/20',
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
        {isStreaming && (
          <Badge variant="default" className="ml-auto bg-green-600 text-[10px] px-1">
            LIVE
          </Badge>
        )}
      </div>

      {session.description && (
        <p className="mt-1.5 line-clamp-1 text-sm">{session.description}</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(session.createdAt)}
        </span>
        {session.toolsUsed.length > 0 && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            {session.toolsUsed.length}
          </span>
        )}
      </div>

      {/* 스트리밍 요약 */}
      {isStreaming && stream.tokens && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground border-t pt-2">
          {stream.tokens.slice(-100)}
          <span className="inline-block w-1 h-3 bg-green-500 ml-0.5 animate-pulse" />
        </p>
      )}
    </button>
  );
}
