type Listener = (count: number) => void;

let unreadCount = 0;
const listeners: Set<Listener> = new Set();

export function setUnreadCount(count: number) {
  unreadCount = count;
  listeners.forEach((l) => l(count));
}

export function getUnreadCount(): number {
  return unreadCount;
}

export function subscribeToUnread(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
