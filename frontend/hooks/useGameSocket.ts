'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getWsBase } from '../lib/api';
import { WebSocketEvent } from '../lib/types';

interface UseGameSocketProps {
  gameId: string;
  token?: string;
  onEvent?: (event: WebSocketEvent) => void;
}

export function useGameSocket({ gameId, token, onEvent }: UseGameSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);
  const connectRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (!gameId || !token) return;

    // Clean previous socket
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${getWsBase()}/ws/games/${gameId}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);

      // Setup Heartbeat Ping
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, 10000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PONG') return;
        if (onEventRef.current) {
          onEventRef.current(data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = () => {
      setConnectionError('WebSocket unavailable. Set NEXT_PUBLIC_WS_URL to the public backend tunnel URL.');
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // Auto-reconnect if not closed normally
      if (event.code !== 1000 && event.code !== 4003) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current();
        }, 2500);
      }
    };
  }, [gameId, token]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  return { isConnected, connectionError, sendMessage };
}
