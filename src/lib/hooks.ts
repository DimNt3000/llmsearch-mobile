import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, isCancelled } from '../api/client';

export type RequestState<T> =
  | { status: 'idle' }
  | { status: 'loading'; startedAt: number }
  | { status: 'done'; data: T }
  | { status: 'error'; error: ApiError };

/**
 * Runs one request at a time: starting a new one aborts the previous, and
 * `cancel()` aborts the current one and returns to idle.
 */
export function useRequest<T>() {
  const [state, setState] = useState<RequestState<T>>({ status: 'idle' });
  const current = useRef<AbortController | null>(null);

  const run = useCallback(async (task: (signal: AbortSignal) => Promise<T>) => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setState({ status: 'loading', startedAt: Date.now() });
    try {
      const data = await task(controller.signal);
      if (current.current === controller) setState({ status: 'done', data });
    } catch (caught) {
      if (current.current !== controller) return;
      if (isCancelled(caught)) {
        setState({ status: 'idle' });
      } else {
        const error = caught instanceof ApiError ? caught : new ApiError('unknown', String(caught));
        setState({ status: 'error', error });
      }
    }
  }, []);

  const cancel = useCallback(() => current.current?.abort(), []);
  const reset = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ status: 'idle' });
  }, []);

  useEffect(
    () => () => {
      const pending = current.current;
      current.current = null;
      pending?.abort();
    },
    [],
  );

  return { state, run, cancel, reset };
}

/**
 * Milliseconds since `startedAt`, ticking once per second while set. Until
 * the first tick `now` predates the start, which the clamp shows as 0:00.
 */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, now - startedAt);
}
