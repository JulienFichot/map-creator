export const MAX_HISTORY = 10;

let history: string[] = [];
const subscribers = new Set<() => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function getHistory(): string[] {
  return history;
}

// Debounced: rapid drag events coalesce into one save (500 ms silence = commit).
export function pushToHistory(color: string): void {
  if (!isValidHex(color)) return;
  const normalized = color.toUpperCase();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    history = [normalized, ...history.filter((c) => c !== normalized)].slice(0, MAX_HISTORY);
    subscribers.forEach((fn) => fn());
    debounceTimer = null;
  }, 500);
}

export function subscribeHistory(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
