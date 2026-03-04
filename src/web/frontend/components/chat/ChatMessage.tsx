import { Card } from '@/components/ui/card';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  text: string;
  timestamp?: string;
}

export function ChatMessage({ role, text, timestamp }: ChatMessageProps) {
  const isBot = role === 'assistant';
  // 안전장치: text가 객체인 경우 문자열로 변환
  const safeText = typeof text === 'string' ? text : JSON.stringify(text);
  return (
    <div className={`flex gap-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isBot ? 'bg-primary/10' : 'bg-muted'}`}>
        {isBot ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <Card className={`max-w-[80%] px-4 py-3 ${isBot ? '' : 'bg-primary text-primary-foreground'}`}>
        <p className="text-sm whitespace-pre-wrap">{safeText}</p>
        {timestamp && <span className="text-xs text-muted-foreground mt-1 block">{timestamp}</span>}
      </Card>
    </div>
  );
}
