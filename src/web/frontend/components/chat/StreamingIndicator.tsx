interface StreamingIndicatorProps {
  text: string;
}

export function StreamingIndicator({ text }: StreamingIndicatorProps) {
  if (!text) return null;
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
      </div>
      <div className="max-w-[80%] px-4 py-3 rounded-lg border bg-card">
        <p className="text-sm whitespace-pre-wrap">
          {text}
          <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse" />
        </p>
      </div>
    </div>
  );
}
