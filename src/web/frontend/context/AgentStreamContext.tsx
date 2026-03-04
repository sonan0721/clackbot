import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';

// ─── 타입 정의 ───

export interface SessionStream {
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

type EventListener = (data: any) => void;

interface AgentStreamContextValue {
  streams: Map<string, SessionStream>;
  connected: boolean;
  send: (data: unknown) => void;
  addEventListener: (listener: EventListener) => () => void;
}

// ─── Reducer ───

function streamReducer(state: StreamState, action: StreamAction): StreamState {
  const sessions = new Map(state.sessions);
  const current = sessions.get(action.sessionId) ?? {
    tokens: '',
    thinking: [],
    tools: [],
    completed: false,
  };

  switch (action.type) {
    case 'token':
      sessions.set(action.sessionId, {
        ...current,
        tokens: current.tokens + action.content,
      });
      break;
    case 'thinking':
      sessions.set(action.sessionId, {
        ...current,
        thinking: [...current.thinking, action.summary],
      });
      break;
    case 'tool_use':
      sessions.set(action.sessionId, {
        ...current,
        tools: [...current.tools, { name: action.toolName, status: 'running' }],
      });
      break;
    case 'tool_result':
      sessions.set(action.sessionId, {
        ...current,
        tools: current.tools.map((t) =>
          t.name === action.toolName ? { ...t, status: 'done' as const } : t
        ),
      });
      break;
    case 'complete':
      sessions.set(action.sessionId, {
        ...current,
        completed: true,
        finalText: action.text,
      });
      break;
    case 'reset':
      sessions.delete(action.sessionId);
      break;
  }

  return { sessions };
}

// ─── Context ───

const AgentStreamContext = createContext<AgentStreamContextValue | null>(null);

// ─── Provider ───

export function AgentStreamProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(streamReducer, {
    sessions: new Map(),
  });
  const listenersRef = useRef<Set<EventListener>>(new Set());
  const knownSessionsRef = useRef<Set<string>>(new Set());

  const addEventListener = useCallback((listener: EventListener) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const handleMessage = useCallback(
    (data: any) => {
      // 등록된 리스너들에게 raw 이벤트 전달
      for (const listener of listenersRef.current) {
        listener(data);
      }
      switch (data.event) {
        // 스트리밍 이벤트
        case 'agent:stream':
          if (data.type === 'token' && data.data?.content) {
            dispatch({
              type: 'token',
              sessionId: data.sessionId,
              content: data.data.content,
            });
          } else if (data.type === 'thinking' && data.data?.thinkingSummary) {
            dispatch({
              type: 'thinking',
              sessionId: data.sessionId,
              summary: data.data.thinkingSummary,
            });
          } else if (data.type === 'tool_use' && data.data?.toolName) {
            dispatch({
              type: 'tool_use',
              sessionId: data.sessionId,
              toolName: data.data.toolName,
            });
          } else if (data.type === 'tool_result' && data.data?.toolName) {
            dispatch({
              type: 'tool_result',
              sessionId: data.sessionId,
              toolName: data.data.toolName,
            });
          }
          // 새 세션의 첫 스트리밍 이벤트 → 세션 목록 즉시 갱신
          if (data.sessionId && !knownSessionsRef.current.has(data.sessionId)) {
            knownSessionsRef.current.add(data.sessionId);
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
          }
          break;

        // 에이전트 완료
        case 'agent:complete':
          if (data.result?.text) {
            dispatch({
              type: 'complete',
              sessionId: data.sessionId,
              text: data.result.text,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-thread'] });
          break;

        // 세션 상태 변경
        case 'session:update':
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          queryClient.invalidateQueries({
            queryKey: ['session', data.sessionId],
          });
          break;

        // 새 활동
        case 'activity:new':
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          if (data.activity?.sessionId) {
            queryClient.invalidateQueries({
              queryKey: ['session', data.activity.sessionId],
            });
          }
          break;

        // 메모리 변경
        case 'memory:update':
          queryClient.invalidateQueries({ queryKey: ['brain-file'] });
          queryClient.invalidateQueries({ queryKey: ['brain-files'] });
          queryClient.invalidateQueries({ queryKey: ['memory'] });
          break;

        // 수신 메시지
        case 'message:incoming':
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          break;

        // 발신 메시지
        case 'message:outgoing':
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          break;
      }
    },
    [queryClient]
  );

  const { connected, send } = useWebSocket(handleMessage);

  const value = useMemo(
    () => ({ streams: state.sessions, connected, send, addEventListener }),
    [state.sessions, connected, send, addEventListener]
  );

  return (
    <AgentStreamContext.Provider value={value}>
      {children}
    </AgentStreamContext.Provider>
  );
}

// ─── Hooks ───

/** 전체 스트리밍 상태 + WebSocket 연결 정보 */
export function useAgentStreams() {
  const ctx = useContext(AgentStreamContext);
  if (!ctx) {
    throw new Error('useAgentStreams must be used within AgentStreamProvider');
  }
  return ctx;
}

/** 특정 세션의 스트리밍 상태 */
export function useSessionStream(sessionId: string | null) {
  const { streams } = useAgentStreams();
  return sessionId ? streams.get(sessionId) ?? null : null;
}

/** 특정 이벤트 타입에 대한 리스너 등록 */
export function useAgentEvent(eventType: string, handler: (data: any) => void) {
  const { addEventListener } = useAgentStreams();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return addEventListener((data: any) => {
      if (data.event === eventType) {
        handlerRef.current(data);
      }
    });
  }, [addEventListener, eventType]);
}
