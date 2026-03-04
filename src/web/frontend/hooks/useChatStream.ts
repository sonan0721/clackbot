import { useCallback, useReducer } from 'react';
import { useWebSocket } from './useWebSocket';

interface SessionStream {
  tokens: string;
  thinking: string[];
  tools: Array<{ name: string; status: 'running' | 'done' }>;
  completed: boolean;
  finalText?: string;
}

interface StreamState {
  sessions: Map<string, SessionStream>;
}

type StreamAction =
  | { type: 'token'; sessionId: string; content: string }
  | { type: 'thinking'; sessionId: string; summary: string }
  | { type: 'tool_use'; sessionId: string; toolName: string }
  | { type: 'tool_result'; sessionId: string; toolName: string }
  | { type: 'complete'; sessionId: string; text: string }
  | { type: 'reset'; sessionId: string };

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  const sessions = new Map(state.sessions);
  const current = sessions.get(action.sessionId) ?? {
    tokens: '', thinking: [], tools: [], completed: false,
  };

  switch (action.type) {
    case 'token':
      sessions.set(action.sessionId, { ...current, tokens: current.tokens + action.content });
      break;
    case 'thinking':
      sessions.set(action.sessionId, { ...current, thinking: [...current.thinking, action.summary] });
      break;
    case 'tool_use':
      sessions.set(action.sessionId, { ...current, tools: [...current.tools, { name: action.toolName, status: 'running' }] });
      break;
    case 'tool_result':
      sessions.set(action.sessionId, {
        ...current,
        tools: current.tools.map(t => t.name === action.toolName ? { ...t, status: 'done' as const } : t),
      });
      break;
    case 'complete':
      sessions.set(action.sessionId, { ...current, completed: true, finalText: action.text });
      break;
    case 'reset':
      sessions.delete(action.sessionId);
      break;
  }

  return { sessions };
}

export function useChatStream() {
  const [state, dispatch] = useReducer(streamReducer, { sessions: new Map() });

  const handleMessage = useCallback((data: any) => {
    switch (data.event) {
      case 'agent:stream':
        if (data.type === 'token' && data.data?.content) {
          dispatch({ type: 'token', sessionId: data.sessionId, content: data.data.content });
        } else if (data.type === 'thinking' && data.data?.thinkingSummary) {
          dispatch({ type: 'thinking', sessionId: data.sessionId, summary: data.data.thinkingSummary });
        } else if (data.type === 'tool_use' && data.data?.toolName) {
          dispatch({ type: 'tool_use', sessionId: data.sessionId, toolName: data.data.toolName });
        } else if (data.type === 'tool_result' && data.data?.toolName) {
          dispatch({ type: 'tool_result', sessionId: data.sessionId, toolName: data.data.toolName });
        }
        break;
      case 'agent:complete':
        if (data.result?.text) {
          dispatch({ type: 'complete', sessionId: data.sessionId, text: data.result.text });
        }
        break;
    }
  }, []);

  const { connected, send } = useWebSocket(handleMessage);

  return { streams: state.sessions, connected, send };
}
