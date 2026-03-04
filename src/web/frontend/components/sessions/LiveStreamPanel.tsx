import { useSessionStream } from '@/context/AgentStreamContext';
import { StreamingIndicator } from '@/components/chat/StreamingIndicator';
import { ThinkingPanel } from '@/components/chat/ThinkingPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';

interface LiveStreamPanelProps {
  sessionId: string;
}

export function LiveStreamPanel({ sessionId }: LiveStreamPanelProps) {
  const stream = useSessionStream(sessionId);

  if (!stream || stream.completed) return null;

  return (
    <Card className="border-green-500/30 bg-green-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="h-4 w-4 text-green-500 animate-pulse" />
          실시간 스트리밍
          <Badge variant="default" className="ml-auto bg-green-600 text-xs">
            LIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stream.tokens && <StreamingIndicator text={stream.tokens} />}
        <ThinkingPanel thinking={stream.thinking} tools={stream.tools} />
      </CardContent>
    </Card>
  );
}
