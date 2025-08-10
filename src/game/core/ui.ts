export function fitCanvasToScreen(canvas: HTMLCanvasElement) {
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { width: w, height: h, dpr };
}
