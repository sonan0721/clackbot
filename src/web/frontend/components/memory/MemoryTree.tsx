import { useState } from 'react';
import { Folder, File, ChevronRight, Circle } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { BrainFileTree } from '@/types/api';

interface MemoryTreeProps {
  files: BrainFileTree[];
  selectedPath: string | null;
  modifiedPaths: Set<string>;
  onSelect: (path: string) => void;
}

interface TreeNodeProps {
  node: BrainFileTree;
  depth: number;
  selectedPath: string | null;
  modifiedPaths: Set<string>;
  onSelect: (path: string) => void;
}

function TreeNode({ node, depth, selectedPath, modifiedPaths, onSelect }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const isModified = modifiedPaths.has(node.path);

  if (node.type === 'directory') {
    // 디렉토리 내 수정된 파일이 있는지 확인
    const hasModifiedChild = Array.from(modifiedPaths).some((p) => p.startsWith(node.path + '/'));
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent',
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              open && 'rotate-90',
            )}
          />
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="truncate">{node.name}</span>
          {hasModifiedChild && (
            <Circle className="ml-auto h-2 w-2 fill-amber-500 text-amber-500" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          {node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              modifiedPaths={modifiedPaths}
              onSelect={onSelect}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent',
        selectedPath === node.path && 'bg-accent font-medium',
      )}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <File className={cn('h-4 w-4 shrink-0', isModified ? 'text-amber-500' : 'text-muted-foreground')} />
      <span className="truncate">{node.name}</span>
      {isModified && (
        <Circle className="ml-auto h-2 w-2 fill-amber-500 text-amber-500" />
      )}
    </button>
  );
}

export function MemoryTree({ files, selectedPath, modifiedPaths, onSelect }: MemoryTreeProps) {
  if (files.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        메모리 파일이 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-0.5 py-2">
      {files.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          modifiedPaths={modifiedPaths}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
