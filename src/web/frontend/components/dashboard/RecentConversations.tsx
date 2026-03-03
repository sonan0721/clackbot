import { MessageSquare } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConversationsResponse } from '@/types/api';

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

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

export function RecentConversations() {
  const { data, isLoading } = useApiQuery<ConversationsResponse>(
    ['conversations', 'recent'],
    '/api/conversations?limit=5',
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">최근 대화</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px] px-6">
          {isLoading ? (
            <div className="space-y-3 pb-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data || data.sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              아직 대화가 없습니다
            </p>
          ) : (
            <ul className="space-y-3 pb-4">
              {data.sessions.map((session) => (
                <li
                  key={session.threadTs}
                  className="rounded-lg border p-3"
                >
                  <p className="text-sm leading-snug">
                    {truncate(session.firstMessage, 80)}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {session.messageCount}
                    </span>
                    <span>{formatRelativeTime(session.lastMessageAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
