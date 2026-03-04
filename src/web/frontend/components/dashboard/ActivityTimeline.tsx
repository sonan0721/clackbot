import { useApiQuery } from '@/hooks/useApi';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentActivityItem } from '@/types/api';

const ACTIVITY_TYPE_CONFIG: Record<
  AgentActivityItem['activityType'],
  { label: string; className: string }
> = {
  tool_use: { label: '도구 사용', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  skill_invoke: { label: '스킬 호출', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  agent_spawn: { label: '에이전트 생성', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  memory_update: { label: '메모리 업데이트', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export function ActivityTimeline() {
  const { data: activities, isLoading } = useApiQuery<AgentActivityItem[]>(
    ['activities', 'recent'],
    '/api/activities?limit=20',
    { staleTime: 5_000 },
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">최근 활동</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px] px-6">
          {isLoading ? (
            <div className="space-y-3 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              아직 활동이 없습니다
            </p>
          ) : (
            <ul className="space-y-3 pb-4">
              {activities.map((activity) => {
                const config = ACTIVITY_TYPE_CONFIG[activity.activityType];
                return (
                  <li
                    key={activity.id}
                    className="flex items-start gap-3 text-sm animate-in slide-in-from-top-2 fade-in duration-300"
                  >
                    <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(activity.createdAt)}
                    </span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 border-0 ${config.className}`}
                    >
                      {config.label}
                    </Badge>
                    <span className="min-w-0 break-words text-foreground">
                      {activity.toolName && (
                        <span className="font-medium">{activity.toolName}</span>
                      )}
                      {activity.toolName && activity.detail && ' — '}
                      {typeof activity.detail === 'string'
                        ? activity.detail
                        : activity.detail
                          ? JSON.stringify(activity.detail)
                          : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
