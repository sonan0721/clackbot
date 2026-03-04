import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { SessionList } from '@/components/sessions/SessionList';
import { SessionDetail } from '@/components/sessions/SessionDetail';
import { useApiQuery } from '@/hooks/useApi';
import type { AgentSessionsResponse } from '@/types/api';

type StatusFilter = 'all' | 'active' | 'completed' | 'failed';

export default function Sessions() {
  const { name } = useParams<{ name: string }>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryParam = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
  const projectParam = name ? `&project=${encodeURIComponent(name)}` : '';
  const { data, isLoading } = useApiQuery<AgentSessionsResponse>(
    ['sessions', statusFilter, name ?? ''],
    `/api/sessions?limit=50${queryParam}${projectParam}`,
  );

  const sessions = data?.sessions ?? [];
  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="세션"
        description={name ? `프로젝트: ${name}` : undefined}
      />
      <div className="p-6">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setSelectedId(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="active">활성</TabsTrigger>
            <TabsTrigger value="completed">완료</TabsTrigger>
            <TabsTrigger value="failed">실패</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <SessionList
                  sessions={sessions}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <div>
                  {selectedSession ? (
                    <SessionDetail session={selectedSession} />
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      왼쪽에서 세션을 선택하세요
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
