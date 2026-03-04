import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import type { ConfigResponse } from '@/types/api';

export function SessionSettings() {
  const { data: config } = useApiQuery<ConfigResponse>(['config'], '/api/config');
  const mutation = useApiMutation<{ message: string }, Partial<ConfigResponse>>(
    '/api/config',
    'PUT',
  );

  const [maxMessages, setMaxMessages] = useState(20);
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    setMaxMessages(config.session.maxMessages);
    setTimeoutMinutes(config.session.timeoutMinutes);
  }, [config]);

  const handleSave = () => {
    mutation.mutate(
      { session: { maxMessages, timeoutMinutes } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">세션 설정</CardTitle>
        <CardDescription>Slack 세션 자동 리셋 조건을 설정합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">최대 메시지 수</label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={maxMessages}
            onChange={(e) => setMaxMessages(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">이 수를 초과하면 세션이 자동 리셋됩니다</p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">타임아웃 (분)</label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={timeoutMinutes}
            onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">마지막 메시지 이후 이 시간이 지나면 세션이 리셋됩니다</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={mutation.isPending} size="sm">
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">저장되었습니다</span>
          )}
          {mutation.isError && (
            <span className="text-sm text-destructive">저장 실패</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
