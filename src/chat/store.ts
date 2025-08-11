// src/chat/store.ts
export type Msg = { role: "user" | "assistant"; content: string; t: number };
const KEY = "chat.histories.v1";

type Bag = Record<string, Msg[]>;

function load(): Bag {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function save(bag: Bag) {
  localStorage.setItem(KEY, JSON.stringify(bag));
}

export const chatStore = {
  list(id: string): Msg[] {
    const bag = load();
    return bag[id] || [];
  },
  push(id: string, msg: Msg) {
    const bag = load();
    const arr = bag[id] || [];
    arr.push(msg);
    // keep last 50
    bag[id] = arr.slice(-50);
    save(bag);
  },
  clear(id: string) {
    const bag = load();
    delete bag[id];
    save(bag);
  }
};

