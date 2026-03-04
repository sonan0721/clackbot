import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Brain, Wrench, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ThinkingPanelProps {
  thinking: string[];
  tools: Array<{ name: string; status: 'running' | 'done' }>;
}

export function ThinkingPanel({ thinking, tools }: ThinkingPanelProps) {
  const [open, setOpen] = useState(false);
  if (thinking.length === 0 && tools.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-11">
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        사고 과정 ({thinking.length}개) / 도구 ({tools.length}개)
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1">
        {thinking.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Brain className="h-3 w-3" />
            <span>{t}</span>
          </div>
        ))}
        {tools.map((tool, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <Wrench className="h-3 w-3" />
            <span>{tool.name}</span>
            <Badge variant={tool.status === 'done' ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
              {tool.status === 'done' ? '완료' : '실행 중...'}
            </Badge>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
