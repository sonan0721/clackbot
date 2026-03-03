import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApi';
import type { AgentActivityItem } from '@/types/api';

const PAGE_SIZE = 30;

type ActivityFilter = 'all' | 'tool_use' | 'skill_invoke' | 'agent_spawn' | 'memory_update';

const ACTIVITY_TYPE_CONFIG: Record<
  AgentActivityItem['activityType'],
  { label: string; className: string }
> = {
  tool_use: {
    label: '도구 사용',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  skill_invoke: {
    label: '스킬 호출',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  agent_spawn: {
    label: '에이전트 생성',
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  memory_update: {
    label: '메모리 업데이트',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export default function ActivityLog() {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(0);

  // 전체 데이터를 충분히 가져와서 클라이언트 필터링
  const { data: activities, isLoading } = useApiQuery<AgentActivityItem[]>(
    ['activities', 'all', String(page)],
    `/api/activities?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
  );

  const allActivities = activities ?? [];

  // 클라이언트 사이드 필터링
  const filtered = useMemo(() => {
    if (filter === 'all') return allActivities;
    return allActivities.filter((a) => a.activityType === filter);
  }, [allActivities, filter]);

  const handleFilterChange = (value: string) => {
    setFilter(value as ActivityFilter);
  };

  return (
    <>
      <PageHeader title="활동 로그" />
      <div className="p-6">
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="tool_use">도구</TabsTrigger>
            <TabsTrigger value="skill_invoke">스킬</TabsTrigger>
            <TabsTrigger value="agent_spawn">에이전트</TabsTrigger>
            <TabsTrigger value="memory_update">메모리</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                {filter === 'all' ? '활동 로그가 없습니다' : '해당 유형의 활동이 없습니다'}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((activity) => {
                  const config = ACTIVITY_TYPE_CONFIG[activity.activityType];
                  return (
                    <Card key={activity.id}>
                      <CardContent className="flex items-start gap-4 py-3">
                        <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                          {formatDateTime(activity.createdAt)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 border-0 ${config.className}`}
                        >
                          {config.label}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {activity.agentType && (
                              <Badge variant="secondary" className="text-xs">
                                {activity.agentType}
                              </Badge>
                            )}
                            {activity.toolName && (
                              <span className="text-sm font-medium">
                                {activity.toolName}
                              </span>
                            )}
                          </div>
                          {activity.detail && (
                            <p className="text-sm text-muted-foreground mt-1 break-words">
                              {activity.detail}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 페이지네이션 */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {page + 1} 페이지
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={allActivities.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
