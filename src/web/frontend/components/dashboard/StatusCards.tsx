import { Wifi, WifiOff, ListTodo, Wrench, Radio } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useApiQuery } from '@/hooks/useApi';
import { useAgentStreams } from '@/context/AgentStreamContext';
import type { AgentSessionsResponse, ToolsResponse } from '@/types/api';

export function StatusCards() {
  const { data: status, isLoading: statusLoading } = useBotStatus();
  const { connected } = useAgentStreams();
  const { data: sessions, isLoading: sessionsLoading } = useApiQuery<AgentSessionsResponse>(
    ['sessions', 'active'],
    '/api/sessions?status=active&limit=1',
    { staleTime: 5_000 },
  );
  const { data: tools, isLoading: toolsLoading } = useApiQuery<ToolsResponse>(
    ['tools'],
    '/api/tools',
  );

  // 스트리밍 중인 세션 수
  const streamingCount = sessions?.total ?? 0;

  const cards = [
    {
      label: '연결 상태',
      value: statusLoading ? null : status?.online ? '온라인' : '오프라인',
      icon: status?.online ? Wifi : WifiOff,
      color: status?.online ? 'text-green-500' : 'text-gray-400',
    },
    {
      label: '활성 세션',
      value: sessionsLoading ? null : streamingCount,
      icon: ListTodo,
      color: 'text-blue-500',
    },
    {
      label: '등록된 도구',
      value: toolsLoading ? null : (tools?.total ?? 0),
      icon: Wrench,
      color: 'text-amber-500',
    },
    {
      label: '실시간 연결',
      value: connected ? '연결됨' : '끊김',
      icon: Radio,
      color: connected ? 'text-green-500' : 'text-red-500',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4">
              <div className={`rounded-lg bg-muted p-2.5 ${card.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                {card.value === null ? (
                  <Skeleton className="mt-1 h-6 w-16" />
                ) : (
                  <p className="text-2xl font-semibold">{card.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
