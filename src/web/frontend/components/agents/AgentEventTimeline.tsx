import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApiQuery } from '@/hooks/useApi';
import { useAgentEvent } from '@/context/AgentStreamContext';
import type { AgentActivityItem } from '@/types/api';

const ACTIVITY_TYPE_CONFIG: Record<
  AgentActivityItem['activityType'],
  { label: string; className: string }
> = {
  tool_use: { label: '도구', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  skill_invoke: { label: '스킬', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  agent_spawn: { label: '에이전트', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  memory_update: { label: '메모리', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
};

interface RealtimeEvent {
  id: string;
  type: string;
  label: string;
  detail: string;
  time: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AgentEventTimeline() {
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);

  // REST로 최근 활동 가져오기
  const { data: activities } = useApiQuery<AgentActivityItem[]>(
    ['activities', 'recent'],
    '/api/activities?limit=30',
    { staleTime: 5_000 },
  );

  // 실시간 이벤트 수신
  useAgentEvent('activity:new', useCallback((data: any) => {
    const activity = data.activity;
    if (!activity) return;
    const config = ACTIVITY_TYPE_CONFIG[activity.activityType as keyof typeof ACTIVITY_TYPE_CONFIG];
    setRealtimeEvents((prev) => [{
      id: `rt-${Date.now()}-${Math.random()}`,
      type: activity.activityType,
      label: config?.label ?? activity.activityType,
      detail: activity.toolName ?? '',
      time: activity.createdAt ?? Date.now(),
    }, ...prev].slice(0, 50));
  }, []));

  useAgentEvent('agent:stream', useCallback((data: any) => {
    if (data.type === 'tool_use') {
      setRealtimeEvents((prev) => [{
        id: `rt-${Date.now()}-${Math.random()}`,
        type: 'tool_use',
        label: '도구',
        detail: data.data?.toolName ?? '',
        time: Date.now(),
      }, ...prev].slice(0, 50));
    }
  }, []));

  useAgentEvent('session:update', useCallback((data: any) => {
    setRealtimeEvents((prev) => [{
      id: `rt-${Date.now()}-${Math.random()}`,
      type: 'session',
      label: '세션',
      detail: `${data.sessionId?.slice(0, 8)}... → ${data.status}`,
      time: Date.now(),
    }, ...prev].slice(0, 50));
  }, []));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">이벤트 타임라인</h3>
        <p className="text-xs text-muted-foreground">실시간 에이전트 이벤트</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1.5 p-3">
          {/* 실시간 이벤트 */}
          {realtimeEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-2 text-xs animate-in slide-in-from-top-2 fade-in duration-200"
            >
              <span className="shrink-0 text-muted-foreground whitespace-nowrap">
                {formatTime(evt.time)}
              </span>
              <Badge
                variant="outline"
                className={`shrink-0 border-0 text-[10px] px-1 py-0 ${
                  ACTIVITY_TYPE_CONFIG[evt.type as keyof typeof ACTIVITY_TYPE_CONFIG]?.className ?? 'bg-gray-100 text-gray-700'
                }`}
              >
                {evt.label}
              </Badge>
              <span className="min-w-0 break-words text-muted-foreground">
                {evt.detail}
              </span>
            </div>
          ))}

          {/* REST 활동 (실시간 이벤트가 없을 때 표시) */}
          {realtimeEvents.length === 0 && activities?.map((activity) => {
            const config = ACTIVITY_TYPE_CONFIG[activity.activityType];
            return (
              <div
                key={activity.id}
                className="flex items-start gap-2 text-xs"
              >
                <span className="shrink-0 text-muted-foreground whitespace-nowrap">
                  {formatTime(new Date(activity.createdAt).getTime())}
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 border-0 text-[10px] px-1 py-0 ${config.className}`}
                >
                  {config.label}
                </Badge>
                <span className="min-w-0 break-words text-muted-foreground">
                  {activity.toolName ?? ''}
                  {activity.detail ? ` — ${activity.detail}` : ''}
                </span>
              </div>
            );
          })}

          {realtimeEvents.length === 0 && (!activities || activities.length === 0) && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              이벤트가 없습니다
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
