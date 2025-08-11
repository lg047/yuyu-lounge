// src/chat/store.ts
export type Msg = { role: "user" | "assistant"; content: string; t: number };

// In-memory only. Clears on refresh or when the tab is closed.
const bag: Record<string, Msg[]> = {};

export const chatStore = {
  list(id: string): Msg[] {
    return bag[id] || [];
  },
  push(id: string, msg: Msg) {
    const arr = bag[id] || [];
    arr.push(msg);
    bag[id] = arr.slice(-50); // keep last 50
  },
  clear(id: string) {
    delete bag[id];
  }
};
