import { useState, useEffect } from 'react';
import { FolderOpen, ChevronRight, ChevronUp, FileText, GitBranch, FolderPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchApi } from '@/hooks/useApi';
import { useApiMutation } from '@/hooks/useApi';

interface BrowseResult {
  current: string;
  parent: string | null;
  dirs: string[];
  hasClaudeMd: boolean;
  hasGit: boolean;
}

export interface ProjectToEdit {
  name: string;
  path: string;
  description?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject?: ProjectToEdit | null;
}

export function CreateProjectDialog({ open, onOpenChange, editProject }: Props) {
  const [name, setName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [description, setDescription] = useState('');
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const isEdit = !!editProject;

  const createMutation = useApiMutation<{ name: string }, { name: string; path: string; description?: string }>(
    isEdit ? `/api/projects/${editProject?.name}` : '/api/projects',
    isEdit ? 'PUT' : 'POST',
  );

  // 편집 모드 초기화
  useEffect(() => {
    if (open && editProject) {
      setName(editProject.name);
      setProjectPath(editProject.path);
      setDescription(editProject.description ?? '');
      setError('');
      // 경로가 있으면 browse 정보도 로드
      loadBrowse(editProject.path);
    } else if (open) {
      setName('');
      setProjectPath('');
      setDescription('');
      setBrowseData(null);
      setError('');
    }
  }, [open, editProject]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !browseData) return;
    try {
      await fetchApi('/api/projects/browse/mkdir', {
        method: 'POST',
        body: JSON.stringify({ parentPath: browseData.current, name: newFolderName.trim() }),
      });
      setNewFolderName('');
      setShowNewFolder(false);
      // 새 폴더로 이동
      await loadBrowse(`${browseData.current}/${newFolderName.trim()}`);
    } catch {
      setError('폴더 생성 실패');
    }
  };

  const loadBrowse = async (dirPath?: string) => {
    setBrowsing(true);
    try {
      const params = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const data = await fetchApi<BrowseResult>(`/api/projects/browse${params}`);
      setBrowseData(data);
      setProjectPath(data.current);
    } catch {
      setError('디렉토리를 읽을 수 없습니다');
    } finally {
      setBrowsing(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !/^\w+$/.test(name.trim())) {
      setError('태그명은 영문/숫자/언더스코어만 가능합니다');
      return;
    }
    if (!projectPath.trim()) {
      setError('프로젝트 경로를 입력하세요');
      return;
    }
    setError('');

    const payload = {
      name: name.trim(),
      path: projectPath.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '프로젝트 수정' : '프로젝트 추가'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '프로젝트 정보를 수정합니다.' : '로컬 프로젝트 디렉토리를 등록합니다.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 태그명 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">태그명</label>
            <Input
              placeholder="my_project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEdit}
            />
          </div>

          {/* 경로 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">경로</label>
            <div className="flex gap-2">
              <Input
                placeholder="/Users/me/projects/my-app"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => loadBrowse(projectPath || undefined)}
                disabled={browsing}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>

            {/* 배지: CLAUDE.md / Git */}
            {browseData && (
              <div className="flex gap-2 mt-1">
                <Badge variant={browseData.hasClaudeMd ? 'default' : 'secondary'}>
                  <FileText className="h-3 w-3 mr-1" />
                  CLAUDE.md {browseData.hasClaudeMd ? '있음' : '없음'}
                </Badge>
                <Badge variant={browseData.hasGit ? 'default' : 'secondary'}>
                  <GitBranch className="h-3 w-3 mr-1" />
                  Git {browseData.hasGit ? '있음' : '없음'}
                </Badge>
              </div>
            )}
          </div>

          {/* 디렉토리 브라우저 */}
          {browseData && (
            <div className="rounded-md border">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" />
                <span className="truncate flex-1">{browseData.current}</span>
                <button
                  className="rounded p-0.5 hover:bg-accent"
                  onClick={() => setShowNewFolder(!showNewFolder)}
                  title="새 폴더"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>
              {showNewFolder && (
                <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
                  <Input
                    placeholder="폴더명"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="h-7 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                    autoFocus
                  />
                  <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCreateFolder}>
                    생성
                  </Button>
                </div>
              )}
              <ScrollArea className="h-40">
                <div className="p-1">
                  {browseData.parent && (
                    <button
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => loadBrowse(browseData.parent!)}
                    >
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">..</span>
                    </button>
                  )}
                  {browseData.dirs.map((dir) => (
                    <button
                      key={dir}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => loadBrowse(`${browseData.current}/${dir}`)}
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{dir}</span>
                    </button>
                  ))}
                  {browseData.dirs.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                      하위 디렉토리 없음
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* 설명 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">설명 (선택)</label>
            <Textarea
              placeholder="프로젝트에 대한 간단한 설명..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? '저장 중...' : isEdit ? '수정' : '추가'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
