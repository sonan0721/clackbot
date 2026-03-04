import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import type { ConfigResponse } from '@/types/api';

export function OwnerSettings() {
  const { data: config } = useApiQuery<ConfigResponse>(['config'], '/api/config');
  const mutation = useApiMutation<{ message: string }, Partial<ConfigResponse>>(
    '/api/config',
    'PUT',
  );

  const [ownerUserId, setOwnerUserId] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!config) return;
    setOwnerUserId(config.ownerUserId ?? '');
  }, [config]);

  const handleSave = () => {
    mutation.mutate(
      { ownerUserId: ownerUserId.trim() || undefined } as Partial<ConfigResponse>,
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
        <CardTitle className="text-base">소유자 설정</CardTitle>
        <CardDescription>봇의 소유자 Slack User ID를 설정합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Owner User ID</label>
          <Input
            placeholder="U01ABCDEF"
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Slack 프로필 {'>'} 더보기에서 멤버 ID를 복사하세요
          </p>
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
