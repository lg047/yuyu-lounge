// src/views/chat.ts
import { CHARACTERS, byId } from "../chat/characters";
import { chatStore, Msg } from "../chat/store";
import { CHAT_PROXY_URL } from "../lib/config";

// Measure viewport and element position, then set chat height exactly.
// Works with iOS visualViewport so the keyboard does not push the input offscreen.
function fitChatHeight(room: HTMLElement): () => void {
  const apply = () => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const vh = vv ? vv.height : window.innerHeight;

    const rectTop = room.getBoundingClientRect().top;

    // read iOS safe-area vars you already have in :root
    const cs = getComputedStyle(document.documentElement);
    const saTop = parseFloat(cs.getPropertyValue("--sa-top")) || 0;
    const saBottom = parseFloat(cs.getPropertyValue("--sa-bottom")) || 0;

    // top gap = distance from top nav to chat window top
    const topGap = Math.max(0, rectTop - saTop);

    // optional tiny cushion so it never visually touches
    const cushion = 4; // px

    // set height so there is an equal gap at the bottom
    // height = viewport - currentTop - safeBottom - topGap - cushion
    // bottomGap = 0.5 * topGap
    const halfTop = Math.floor(topGap * 0.7);
    const h = Math.max(320, Math.floor(vh - rectTop - saBottom - halfTop - cushion));


    room.style.height = Math.max(320, h) + "px";
    room.style.maxHeight = "none";
  };

  apply();

  const onResize = () => apply();
  const ro = new ResizeObserver(apply);
  ro.observe(document.body);
  window.addEventListener("resize", onResize, { passive: true });
  if ((window as any).visualViewport) {
    const vv = (window as any).visualViewport as VisualViewport;
    vv.addEventListener("resize", onResize, { passive: true });
    vv.addEventListener("scroll", onResize, { passive: true });
  }

  return () => {
    ro.disconnect();
    window.removeEventListener("resize", onResize);
    if ((window as any).visualViewport) {
      const vv = (window as any).visualViewport as VisualViewport;
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    }
  };
}



function createLoader(): HTMLDivElement {
  const o = document.createElement("div");
  o.className = "loading-overlay";
  o.innerHTML = `<div class="px-spinner"><i></i><i></i><i></i></div>`;
  return o;
}
function showLoader(root: HTMLElement) {
  if (!root.querySelector(".loading-overlay")) {
    root.appendChild(createLoader());
  }
}
function hideLoader(root: HTMLElement) {
  const o = root.querySelector<HTMLDivElement>(".loading-overlay");
  if (!o) return;
  o.classList.add("hide");
  setTimeout(() => o.remove(), 220);
}


export default function ChatView(): HTMLElement {
  const root = document.createElement("div");
  root.className = "chat";
  const state = { id: currentId() };

  function currentId(): string | null {
    const m = location.hash.match(/^#\/chat\/([^/?#]+)/);
    return m ? m[1] : null;
  }


function render() {
  // cleanup previous listeners if any
  if ((render as any)._cleanup) {
    (render as any)._cleanup();
    (render as any)._cleanup = null;
  }

  root.innerHTML = "";
  showLoader(root);

  state.id = currentId();
  if (!state.id) {
    const el = renderSelect();
    root.appendChild(el);

    const imgs = Array.from(el.querySelectorAll("img"));
    const waits = imgs.map(img =>
      (img as HTMLImageElement).decode
        ? (img as HTMLImageElement).decode().catch(() => {})
        : new Promise(res => {
            (img as HTMLImageElement).onload = (img as HTMLImageElement).onerror = () => res(null);
          })
    );
    Promise.all(waits).then(() => hideLoader(root));
  } else {
    const c = byId(state.id);
    if (!c) {
      const el = renderSelect();
      root.appendChild(el);
      hideLoader(root);
    } else {
      const shell = renderRoom(c);
      root.appendChild(shell);
      // fit height once the DOM is in place
      const room = shell.querySelector(".chat-room") as HTMLElement;
      const stop = fitChatHeight(room);
      (render as any)._cleanup = stop;

      requestAnimationFrame(() => hideLoader(root));
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
    card.style.setProperty("--fill", c.color); // solid fill same as border
    card.setAttribute("data-id", c.id);
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

function renderRoom(c: { id: string; name: string; color: string; }) {
  // shell near top on desktop, full on mobile
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

  const avatar = document.createElement("img");
  avatar.className = "chat-title-avatar";
  avatar.src = `${import.meta.env.BASE_URL || "/"}assets/portraits/${c.id}.png`;
  avatar.alt = c.name;

  const name = document.createElement("span");
  name.textContent = c.name;

  title.appendChild(avatar);
  title.appendChild(name);
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

  // grow textarea
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
  }, { passive: true });

  // Enter sends, Shift+Enter newline
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

    const payload = {
      characterId: c.id,
      messages: chatStore.list(c.id).map(m => ({ role: m.role, content: m.content }))
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
