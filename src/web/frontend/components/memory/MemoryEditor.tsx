import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { useApiQuery, fetchApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { BrainFileContent } from '@/types/api';

interface MemoryEditorProps {
  filePath: string;
  externallyModified?: boolean;
  onDismissModified?: () => void;
}

export function MemoryEditor({ filePath, externallyModified, onDismissModified }: MemoryEditorProps) {
  const queryClient = useQueryClient();
  const encodedPath = encodeURIComponent(filePath);

  const { data, isLoading } = useApiQuery<BrainFileContent>(
    ['brain-file', filePath],
    `/api/memory/brain/${encodedPath}`,
  );

  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // 파일 내용이 로드되면 에디터에 반영
  useEffect(() => {
    if (data?.content != null) {
      setEditContent(data.content);
      setDirty(false);
    }
  }, [data?.content]);

  const handleChange = (value: string) => {
    setEditContent(value);
    setDirty(value !== (data?.content ?? ''));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchApi(`/api/memory/brain/${encodedPath}`, {
        method: 'PUT',
        body: JSON.stringify({ content: editContent }),
      });
      queryClient.invalidateQueries({ queryKey: ['brain-file', filePath] });
      setDirty(false);
    } catch {
      // 에러 무시
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    if (data?.content != null) {
      setEditContent(data.content);
      setDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: ['brain-file', filePath] });
    onDismissModified?.();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 외부 수정 알림 */}
      {externallyModified && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="flex-1">이 파일이 외부에서 수정되었습니다.</span>
          <Button variant="outline" size="sm" onClick={handleReload}>
            다시 불러오기
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismissModified}>
            무시
          </Button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{filePath}</h3>
          {data?.lastModified && (
            <p className="text-xs text-muted-foreground">
              마지막 수정: {new Date(data.lastModified).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevert}
            disabled={!dirty}
          >
            <RotateCcw className="h-4 w-4" />
            되돌리기
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>

      {/* 에디터 */}
      <Textarea
        value={editContent}
        onChange={(e) => handleChange(e.target.value)}
        className="min-h-[400px] flex-1 resize-none font-mono text-sm"
        placeholder="파일 내용이 비어 있습니다"
      />
    </div>
  );
}
