import { abortable, requestSignal } from './request';

export const AI_MIN_INTERVAL_MS = 3000;
const QUEUE_TIMEOUT_MS = 90000;
const MAX_WAIT_MS = 30000;
const NOTE_TTL_MS = 30 * 60 * 1000;
const MAX_NOTE_CHARS = 2_000_000;
const MAX_NOTE_ENTRIES = 4;

interface RateState {
  nextAt: number;
  blockedUntil: number;
}
interface SessionStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<unknown>;
}
type Lock = <T>(
  key: string,
  signal: AbortSignal,
  operation: () => Promise<T>,
) => Promise<T>;
interface RuntimeConfig {
  storage?: SessionStorage;
  lock?: Lock;
  intervalMs?: number;
  now?: () => number;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}
export interface NoteCheckpoint {
  get(part: string): string | undefined;
  set(part: string, value: string): void;
  delete(part: string): void;
}
export interface AiRuntime {
  request<T>(
    endpoint: string,
    options: { signal?: AbortSignal; onProgress?: (text: string) => void },
    operation: (
      cooldown: (header: string | null) => Promise<number>,
    ) => Promise<T>,
  ): Promise<T>;
  prepare<T>(
    key: string,
    signal: AbortSignal | undefined,
    operation: (notes: NoteCheckpoint) => Promise<T>,
  ): Promise<T>;
}

export function retryAfterMs(header: string | null, now = Date.now()): number {
  const value = header?.trim();
  if (value && /^\d+(?:\.\d+)?$/.test(value)) {
    const milliseconds = Number(value) * 1000;
    if (Number.isFinite(milliseconds)) return Math.max(1000, milliseconds);
  }
  if (value) {
    const date = Date.parse(value);
    if (Number.isFinite(date)) return Math.max(1000, date - now);
  }
  return 30000;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cancel = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal.addEventListener('abort', cancel, { once: true });
  });
}

// Keep the tail until the actual operation settles, even if a waiting caller aborts.
function serialQueue(): Lock {
  const tails = new Map<string, Promise<void>>();
  return <T>(key: string, signal: AbortSignal, operation: () => Promise<T>) => {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(() => {
      signal.throwIfAborted();
      return operation();
    });
    const tail = result.then(
      () => {},
      () => {},
    );
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return abortable(result, signal);
  };
}

export function createAiRuntime(config: RuntimeConfig = {}): AiRuntime {
  const now = config.now ?? Date.now;
  const wait = config.wait ?? pause;
  const interval = Math.max(0, config.intervalMs ?? AI_MIN_INTERVAL_MS);
  const serial = serialQueue();
  const lock: Lock =
    config.lock ??
    (async (key, signal, operation) => {
      if (globalThis.navigator?.locks)
        return await navigator.locks.request(key, { signal }, operation);
      return serial(key, signal, operation);
    });
  const rates = new Map<string, RateState>();
  const notes = new Map<
    string,
    { touched: number; values: Map<string, string> }
  >();

  async function readRate(key: string): Promise<RateState> {
    let value: unknown = rates.get(key);
    if (config.storage) {
      try {
        value = (await config.storage.get(key))[key];
      } catch {
        throw new Error('读取 AI 请求队列失败，请重新打开侧栏后重试。');
      }
    }
    const stored = value as Partial<RateState> | undefined;
    const valid = (number: unknown) =>
      typeof number === 'number' && Number.isFinite(number) && number >= 0;
    return {
      nextAt: valid(stored?.nextAt) ? stored!.nextAt! : 0,
      blockedUntil: valid(stored?.blockedUntil) ? stored!.blockedUntil! : 0,
    };
  }
  async function writeRate(key: string, state: RateState) {
    rates.set(key, state);
    if (config.storage) {
      try {
        await config.storage.set({ [key]: state });
      } catch {
        throw new Error('保存 AI 请求队列失败，请重新打开侧栏后重试。');
      }
    }
  }
  function pruneNotes(keep?: string) {
    const time = now();
    for (const [key, value] of notes)
      if (key !== keep && time - value.touched > NOTE_TTL_MS) notes.delete(key);
    let size = [...notes.values()].reduce(
      (total, entry) =>
        total +
        [...entry.values.values()].reduce((n, text) => n + text.length, 0),
      0,
    );
    for (const [key, value] of [...notes].sort(
      (a, b) => a[1].touched - b[1].touched,
    )) {
      if (notes.size <= MAX_NOTE_ENTRIES && size <= MAX_NOTE_CHARS) break;
      if (key === keep && notes.size > 1) continue;
      size -= [...value.values.values()].reduce(
        (n, text) => n + text.length,
        0,
      );
      notes.delete(key);
    }
  }

  return {
    async request(endpoint, options, operation) {
      const origin = new URL(endpoint).origin;
      const key = 'biliSum.ai.rate.v1:' + origin;
      const queued = requestSignal(options.signal, QUEUE_TIMEOUT_MS);
      options.onProgress?.('正在等待 AI 请求队列，可随时停止');
      try {
        return await lock(key, queued.signal, async () => {
          // Queue time does not consume the model's response timeout.
          queued.signal.throwIfAborted();
          queued.dispose();
          const active = options.signal ?? new AbortController().signal;
          const state = await readRate(key);
          active.throwIfAborted();
          let remaining = Math.max(state.nextAt, state.blockedUntil) - now();
          if (remaining > MAX_WAIT_MS)
            throw new Error(
              '模型服务正在限流，请在 ' +
                Math.ceil(remaining / 1000) +
                ' 秒后重试。已完成的分段笔记会保留。',
            );
          while (remaining > 0) {
            options.onProgress?.(
              '正在控制请求频率，' + Math.ceil(remaining / 1000) + ' 秒后继续',
            );
            await wait(Math.min(1000, remaining), active);
            remaining = Math.max(state.nextAt, state.blockedUntil) - now();
          }
          active.throwIfAborted();
          let persistedNextAt = state.nextAt;
          const persist = async () => {
            await writeRate(key, state);
            persistedNextAt = state.nextAt;
          };
          state.nextAt = now() + interval;
          await persist();
          active.throwIfAborted();
          // Storage itself can be slow. Measure the interval from the actual
          // operation start, and persist that correction while the lock is held.
          state.nextAt = Math.max(state.nextAt, now() + interval);
          try {
            return await operation(async (header) => {
              const delay = retryAfterMs(header, now());
              state.blockedUntil = Math.max(state.blockedUntil, now() + delay);
              await persist();
              return Math.ceil(delay / 1000);
            });
          } finally {
            if (state.nextAt !== persistedNextAt && state.nextAt > now()) {
              try {
                await persist();
              } catch {
                // Never discard a completed paid result because this correction
                // failed. Keep the lock until the real start interval expires.
                await wait(
                  Math.max(0, state.nextAt - now()),
                  new AbortController().signal,
                );
              }
            }
          }
        });
      } catch (error) {
        if (queued.signal.aborted) {
          if (options.signal?.aborted) throw options.signal.reason;
          throw new Error(
            '等待其他 AI 请求超时，请稍后重试或停止其他窗口中的生成。',
          );
        }
        throw error;
      } finally {
        queued.dispose();
      }
    },
    async prepare(key, signal, operation) {
      const active = signal ?? new AbortController().signal;
      return serial('notes:' + key, active, async () => {
        active.throwIfAborted();
        pruneNotes();
        let entry = notes.get(key);
        if (!entry) {
          entry = { touched: now(), values: new Map() };
          notes.set(key, entry);
        }
        const current = entry;
        current.touched = now();
        return operation({
          get: (part) => current.values.get(part),
          delete: (part) => current.values.delete(part),
          set: (part, value) => {
            active.throwIfAborted();
            current.values.set(part, value);
            current.touched = now();
            pruneNotes(key);
          },
        });
      });
    },
  };
}
