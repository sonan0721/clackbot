import { PageHeader } from '@/components/layout/PageHeader';
import { PersonalityEditor } from '@/components/settings/PersonalityEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useApiQuery } from '@/hooks/useApi';
import type { ConfigResponse } from '@/types/api';

export default function Settings() {
  const { data: status, isLoading: statusLoading } = useBotStatus();
  const { data: config, isLoading: configLoading } = useApiQuery<ConfigResponse>(
    ['config'],
    '/api/config',
  );

  return (
    <>
      <PageHeader title="설정" />
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* 성격 프리셋 에디터 */}
        <PersonalityEditor />

        {/* 연결 정보 (읽기 전용) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">연결 정보</CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading || configLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : (
              <dl className="space-y-3 text-sm">
                <InfoRow label="봇 이름" value={status?.botName ?? '-'} />
                <InfoRow label="워크스페이스" value={status?.teamName ?? config?.slack.teamName ?? '-'} />
                <InfoRow label="포트" value={String(config?.webPort ?? status?.port ?? '-')} />
                <InfoRow label="버전" value={status?.version ?? '-'} />
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
