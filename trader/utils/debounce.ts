// src/utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(fn: T, ms = 400) {
  let t: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      fn(...args);
      t = null;
    }, ms);
  };

  debounced.clear = () => {
    if (t) {
      clearTimeout(t);
      t = null;
    }
  };

  debounced.flush = (...args: Parameters<T>) => {
    if (t) {
      clearTimeout(t);
      fn(...args);
      t = null;
    }
  };

  return debounced as ((
    ...args: Parameters<T>
  ) => void) & { clear: () => void; flush: (...args: Parameters<T>) => void };
}
