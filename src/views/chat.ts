// src/views/chat.ts
import { CHARACTERS, byId } from "../chat/characters";
import { chatStore, Msg } from "../chat/store";
import { CHAT_PROXY_URL } from "../lib/config";

export default function ChatView(): HTMLElement {
  const root = document.createElement("div");
  root.className = "chat";
  const state = { id: currentId() };

  function currentId(): string | null {
    const m = location.hash.match(/^#\/chat\/([^/?#]+)/);
    return m ? m[1] : null;
  }

  function render() {
    root.innerHTML = "";
    state.id = currentId();
    if (!state.id) {
      root.appendChild(renderSelect());
    } else {
      const c = byId(state.id);
      if (!c) {
        root.appendChild(renderSelect());
      } else {
        root.appendChild(renderRoom(c));
      }
    }
  }

  window.addEventListener("hashchange", () => render(), { passive: true });
  render();
  return root;
}

function renderSelect(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "chat-select";

  const title = document.createElement("h1");
  title.textContent = "Who would you like to talk with?";
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "chat-grid";

  for (const c of CHARACTERS) {
    const card = document.createElement("button");
    card.className = "chat-card";
    card.style.setProperty("--accent", c.color);
    card.onclick = () => {
      location.hash = `#/chat/${c.id}`;
    };

    const img = document.createElement("img");
    img.src = `${import.meta.env.BASE_URL || "/"}assets/portraits/${c.portrait}`;
    img.alt = c.name;
    img.loading = "lazy";
    img.decoding = "async";

    const label = document.createElement("div");
    label.className = "chat-card-label";
    label.textContent = c.name;

    card.appendChild(img);
    card.appendChild(label);
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  return wrap;
}

function renderRoom(c: { id: string; name: string; color: string }) {
  // shell centers a small window on desktop, full height on mobile
  const shell = document.createElement("div");
  shell.className = "chat-room-shell";
  shell.style.setProperty("--accent", c.color);

  const wrap = document.createElement("div");
  wrap.className = "chat-room";
  shell.appendChild(wrap);

  // header
  const header = document.createElement("div");
  header.className = "chat-head";

  const back = document.createElement("a");
  back.href = "#/chat";
  back.className = "chat-back";
  back.textContent = "‹";
  header.appendChild(back);

  const title = document.createElement("div");
  title.className = "chat-title";
  title.textContent = c.name;
  header.appendChild(title);

  const clear = document.createElement("button");
  clear.className = "chat-clear";
  clear.textContent = "Clear";
  clear.onclick = () => {
    chatStore.clear(c.id);
    list.replaceChildren();
  };
  header.appendChild(clear);

  wrap.appendChild(header);

  // messages
  const list = document.createElement("div");
  list.className = "chat-list";
  wrap.appendChild(list);

  // input
  const form = document.createElement("form");
  form.className = "chat-form";

  const ta = document.createElement("textarea");
  ta.placeholder = `Talk to ${c.name}…`;
  ta.rows = 1;
  ta.maxLength = 2000;
  ta.inputMode = "text";
  ta.autocapitalize = "sentences";
  ta.autocomplete = "off";
  ta.spellcheck = true;

  const send = document.createElement("button");
  send.type = "submit";
  send.className = "chat-send";
  send.textContent = "Send";

  form.appendChild(ta);
  form.appendChild(send);
  wrap.appendChild(form);

  // restore history
  for (const m of chatStore.list(c.id)) {
    list.appendChild(renderMsg(m));
  }
  list.scrollTop = list.scrollHeight;

  // auto grow textarea
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
  }, { passive: true });

  // ENTER to send, SHIFT+ENTER for newline
  ta.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      form.requestSubmit();
    }
  });

  // submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    ta.value = "";
    ta.style.height = "auto";

    const um: Msg = { role: "user", content: text, t: Date.now() };
    chatStore.push(c.id, um);
    list.appendChild(renderMsg(um));
    list.scrollTop = list.scrollHeight;

    const hist = chatStore.list(c.id);
    const payload = {
      characterId: c.id,
      messages: hist.map(m => ({ role: m.role, content: m.content }))
    };

    const thinking = renderBubble("assistant", "…");
    list.appendChild(thinking);
    list.scrollTop = list.scrollHeight;

    try {
      const res = await fetch(CHAT_PROXY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const am: Msg = { role: "assistant", content: String(data.content || ""), t: Date.now() };
      chatStore.push(c.id, am);
      thinking.replaceWith(renderMsg(am));
      list.scrollTop = list.scrollHeight;
    } catch {
      thinking.replaceWith(renderBubble("assistant", "Sorry, the chat service is unavailable."));
    }
  });

  return shell;
}

function renderMsg(m: Msg): HTMLElement {
  return renderBubble(m.role, m.content);
}

function renderBubble(role: "user" | "assistant", text: string): HTMLElement {
  const row = document.createElement("div");
  row.className = `chat-row ${role}`;
  const b = document.createElement("div");
  b.className = "chat-bubble";
  b.textContent = text;
  row.appendChild(b);
  return row;
}
