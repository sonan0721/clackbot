import { useState } from 'react';
import { useApiQuery, fetchApi } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentSessionSummary, AgentActivityItem } from '@/types/api';

interface SessionDetailResponse extends AgentSessionSummary {
  activities: AgentActivityItem[];
}

interface SessionDetailProps {
  session: AgentSessionSummary;
}

const ACTIVITY_TYPE_CONFIG: Record<
  AgentActivityItem['activityType'],
  { label: string; className: string }
> = {
  tool_use: { label: '도구 사용', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  skill_invoke: { label: '스킬 호출', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  agent_spawn: { label: '에이전트 생성', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  memory_update: { label: '메모리 업데이트', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SessionDetail({ session }: SessionDetailProps) {
  const queryClient = useQueryClient();
  const [killing, setKilling] = useState(false);

  const { data: detail, isLoading } = useApiQuery<SessionDetailResponse>(
    ['session', session.id],
    `/api/sessions/${session.id}`,
    { enabled: !!session.id },
  );

  const handleKill = async () => {
    setKilling(true);
    try {
      await fetchApi(`/api/sessions/${session.id}/kill`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['session', session.id] });
    } catch {
      // 에러는 무시
    } finally {
      setKilling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!detail) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        세션 정보를 불러올 수 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{detail.agentType}</h3>
          {detail.description && (
            <p className="text-sm text-muted-foreground">{detail.description}</p>
          )}
        </div>
        {detail.status === 'active' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleKill}
            disabled={killing}
          >
            {killing ? '종료 중...' : '세션 종료'}
          </Button>
        )}
      </div>

      {/* 메타 정보 */}
      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">시작 시간</dt>
            <dd>{formatDateTime(detail.createdAt)}</dd>
            <dt className="text-muted-foreground">마지막 활동</dt>
            <dd>{formatDateTime(detail.lastActiveAt)}</dd>
            {detail.completedAt && (
              <>
                <dt className="text-muted-foreground">종료 시간</dt>
                <dd>{formatDateTime(detail.completedAt)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">메시지 수</dt>
            <dd>{detail.messageCount}</dd>
            <dt className="text-muted-foreground">사용된 도구</dt>
            <dd>
              {detail.toolsUsed.length > 0
                ? detail.toolsUsed.join(', ')
                : '없음'}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {/* 활동 로그 */}
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">활동 로그</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[320px] px-6">
            {detail.activities.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                활동 기록이 없습니다
              </p>
            ) : (
              <ul className="space-y-3 pb-4">
                {detail.activities.map((activity) => {
                  const config = ACTIVITY_TYPE_CONFIG[activity.activityType];
                  return (
                    <li
                      key={activity.id}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">
                        {formatDateTime(activity.createdAt)}
                      </span>
                      <Badge
                        variant="outline"
                        className={`shrink-0 border-0 ${config.className}`}
                      >
                        {config.label}
                      </Badge>
                      <span className="min-w-0 break-words">
                        {activity.toolName && (
                          <span className="font-medium">{activity.toolName}</span>
                        )}
                        {activity.toolName && activity.detail && ' — '}
                        {activity.detail}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
