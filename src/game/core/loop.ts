import { fitCanvasToScreen } from "./ui";
import { makePointer } from "./input";
import { makeAudio, AudioCore } from "./audio";
import { store } from "./storage";

export type Core = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  input: ReturnType<typeof makePointer>;
  audio: AudioCore;
  store: typeof store;
  run: (step: (dt: number) => void, draw: () => void) => void;
  stop: () => void;
  resize: () => void;
};

export function makeCore(canvas: HTMLCanvasElement): Core {
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.imageSmoothingEnabled = false;

  let raf = 0;
  let running = false;
  let width = 0, height = 0, dpr = 1;

  const input = makePointer(canvas);
  const audio = makeAudio();

  function resize() {
    const s = fitCanvasToScreen(canvas);
    width = s.width; height = s.height; dpr = s.dpr;
  }
  resize();
  window.addEventListener("resize", resize);

  let last = performance.now();

  function run(step: (dt: number) => void, draw: () => void) {
    if (running) return;
    running = true;
    last = performance.now();
    const loop = (now: number) => {
      input.newFrame();
      const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  return { canvas, ctx, width, height, dpr, input, audio, store, run, stop, resize };
}
