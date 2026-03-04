import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/agents/AgentCard';
import { AgentStreamViewer } from '@/components/agents/AgentStreamViewer';
import { AgentEventTimeline } from '@/components/agents/AgentEventTimeline';
import { useAgentStreams } from '@/context/AgentStreamContext';
import { useApiQuery, fetchApi } from '@/hooks/useApi';
import type { AgentSessionsResponse, AgentSessionSummary } from '@/types/api';

export default function AgentControlCenter() {
  const { streams, connected } = useAgentStreams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active'>('all');
  const [killing, setKilling] = useState(false);

  const statusParam = filter === 'active' ? '&status=active' : '';
  const { data, isLoading } = useApiQuery<AgentSessionsResponse>(
    ['sessions', filter],
    `/api/sessions?limit=100${statusParam}`,
    { staleTime: 5_000 },
  );

  const sessions = data?.sessions ?? [];
  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;
  const activeCount = sessions.filter((s) => s.status === 'active').length;

  const handleKill = async (session: AgentSessionSummary) => {
    setKilling(true);
    try {
      await fetchApi(`/api/sessions/${session.id}/kill`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch {
      // 에러 무시
    } finally {
      setKilling(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="에이전트 관제"
        description="실시간 에이전트 모니터링 및 관리"
        actions={
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <Badge variant="default" className="bg-green-600">
                활성 {activeCount}
              </Badge>
            )}
            <Badge variant={connected ? 'default' : 'destructive'} className={connected ? 'bg-green-600' : ''}>
              {connected ? '연결됨' : '연결 끊김'}
            </Badge>
          </div>
        }
      />

      <div className="flex flex-1 border-t overflow-hidden">
        {/* 왼쪽: 에이전트 목록 */}
        <div className="w-72 shrink-0 border-r flex flex-col">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter('all')}
            >
              전체
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter('active')}
            >
              활성만
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))
              ) : sessions.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  {filter === 'active' ? '활성 에이전트가 없습니다' : '에이전트 세션이 없습니다'}
                </p>
              ) : (
                sessions.map((session) => (
                  <AgentCard
                    key={session.id}
                    session={session}
                    stream={streams.get(session.id) ?? null}
                    isSelected={selectedId === session.id}
                    onClick={() => setSelectedId(session.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 가운데: 선택된 에이전트 스트림 뷰어 */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedSession ? (
            <>
              <AgentStreamViewer session={selectedSession} />
              {selectedSession.status === 'active' && (
                <div className="border-t px-4 py-2 flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleKill(selectedSession)}
                    disabled={killing}
                  >
                    {killing ? '종료 중...' : '세션 종료'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              왼쪽에서 에이전트를 선택하세요
            </div>
          )}
        </div>

        {/* 오른쪽: 이벤트 타임라인 */}
        <div className="w-72 shrink-0 border-l">
          <AgentEventTimeline />
        </div>
      </div>
    </div>
  );
}
