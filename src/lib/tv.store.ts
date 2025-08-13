// Local resume store per channel. No server. Minimal API.

export type ResumeState = { epIndex: number; tSec: number };
const NS = "tv:v1:resume:";

export function loadResume(channelId: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(NS + channelId);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.epIndex !== "number" || typeof v?.tSec !== "number") return null;
    return v;
  } catch {
    return null;
  }
}

export function saveResume(channelId: string, epIndex: number, tSec: number): void {
  try {
    const safeTime = Number.isFinite(tSec) ? Math.max(0, tSec) : 0;
    localStorage.setItem(NS + channelId, JSON.stringify({ epIndex, tSec: safeTime }));
  } catch {
    // ignore
  }
}
