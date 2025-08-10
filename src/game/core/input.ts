export type PointerState = {
  x: number; y: number; down: boolean; justPressed: boolean; justReleased: boolean;
  vx: number; vy: number; tDown: number; tUp: number;
};

export function makePointer(canvas: HTMLCanvasElement) {
  const p: PointerState = {
    x: 0, y: 0, down: false, justPressed: false, justReleased: false,
    vx: 0, vy: 0, tDown: 0, tUp: 0
  };

  let lastX = 0, lastY = 0, lastT = 0;

  function toLocal(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left);
    const y = (e.clientY - r.top);
    return { x, y, t: performance.now() };
  }

  canvas.addEventListener("pointerdown", e => {
    const v = toLocal(e);
    p.x = v.x; p.y = v.y; p.down = true; p.justPressed = true;
    lastX = v.x; lastY = v.y; lastT = v.t; p.tDown = v.t;
    canvas.setPointerCapture(e.pointerId);
  }, { passive: true });

  canvas.addEventListener("pointermove", e => {
    const v = toLocal(e);
    const dt = Math.max(1, v.t - lastT);
    p.vx = (v.x - lastX) / dt;
    p.vy = (v.y - lastY) / dt;
    p.x = v.x; p.y = v.y; lastX = v.x; lastY = v.y; lastT = v.t;
  }, { passive: true });

  canvas.addEventListener("pointerup", e => {
    const v = toLocal(e);
    p.x = v.x; p.y = v.y; p.down = false; p.justReleased = true; p.tUp = v.t;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }, { passive: true });

  function newFrame() {
    p.justPressed = false;
    p.justReleased = false;
  }

  return { p, newFrame };
}
