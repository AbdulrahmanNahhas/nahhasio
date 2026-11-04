// Image-element failures happen after the native URL query has already succeeded.
const failures = new Set<string>();
const listeners = new Set<() => void>();
export const artworkImageFailures = {
  count: () => failures.size,
  subscribe: (notify: () => void) => {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  },
  set: (instance: string, failed: boolean) => {
    const changed = failed ? !failures.has(instance) : failures.has(instance);
    if (!changed) return;
    if (failed) failures.add(instance);
    else failures.delete(instance);
    for (const notify of listeners) notify();
  },
};
