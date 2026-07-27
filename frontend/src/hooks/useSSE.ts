import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error';

export function useSSE(onComplete?: (data: any) => void) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [streamText, setStreamText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useAuthStore();
  const aborterRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (aborterRef.current) {
        aborterRef.current.abort();
        aborterRef.current = null;
      }
    };
  }, []);

  const startStream = useCallback(async (payload: any) => {
    if (aborterRef.current) {
      aborterRef.current.abort();
    }
    aborterRef.current = new AbortController();
    const signal = aborterRef.current.signal;

    setStatus('streaming');
    setError(null);
    setStreamText('');

    try {
      const res = await fetch(`${API_BASE}/questions/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!mountedRef.current) { reader.cancel(); return; }

        const chunk = decoder.decode(value);
        const events = chunk.split('\n\n').filter(Boolean);

        for (const event of events) {
          if (!mountedRef.current) return;
          if (event.startsWith('data: ')) {
            try {
              const data = JSON.parse(event.slice(6));

              if (data.type === 'progress') {
                setStreamText(prev => prev + data.message + '\n');
              } else if (data.type === 'chunk') {
                setStreamText(prev => prev + data.data);
              } else if (data.type === 'complete') {
                setStatus('complete');
                if (onComplete) onComplete(data);
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Generation failed');
              }
            } catch (e: any) {
              if (e.message !== 'Generation failed') {
                // ignore partial parse errors
              } else {
                throw e;
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStatus('error');
      setError(err.message || 'Stream failed');
    }
  }, [accessToken, onComplete]);

  return { status, streamText, error, startStream, setStatus };
}
