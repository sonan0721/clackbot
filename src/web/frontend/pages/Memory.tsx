import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MemoryTree } from '@/components/memory/MemoryTree';
import { MemoryEditor } from '@/components/memory/MemoryEditor';
import { useApiQuery } from '@/hooks/useApi';
import type { BrainFileTree } from '@/types/api';

interface BrainTreeResponse {
  files: BrainFileTree[];
}

export default function Memory() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const { data, isLoading } = useApiQuery<BrainTreeResponse>(
    ['brain-files'],
    '/api/memory/brain',
  );

  const files = data?.files ?? [];

  return (
    <>
      <PageHeader title="메모리" description="Brain 메모리 파일 관리" />
      <div className="flex h-[calc(100vh-3.5rem)] border-t">
        {/* 왼쪽: 파일 트리 */}
        <div className="w-56 shrink-0 border-r">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <MemoryTree
                files={files}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            )}
          </ScrollArea>
        </div>

        {/* 오른쪽: 에디터 */}
        <div className="flex-1 p-6">
          {selectedPath ? (
            <MemoryEditor filePath={selectedPath} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              왼쪽에서 파일을 선택하세요
            </div>
          )}
        </div>
      </div>
    </>
  );
}
