import { useEffect, useRef, useCallback, useState } from 'react';

type MessageHandler = (data: unknown) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const [connected, setConnected] = useState(false);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let ws: WebSocket;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // 자동 재연결 (3초 후)
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch { /* ignore parse errors */ }
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws.close();
      wsRef.current = null;
    };
  }, []); // 의존성 없음 — ref로 최신 핸들러 참조

  return { connected, send };
}
