/** Exponential-decay approach toward a target, re-evaluated every frame (no queued tweens).
 * `durationMs` is the nominal transition duration from section 4.3; the time constant is
 * durationMs/3 so the value is ~95% of the way there by then. */
export function approach(current: number, target: number, dtMs: number, durationMs: number): number {
  if (durationMs <= 0) return target;
  const factor = 1 - Math.exp(-dtMs / (durationMs / 3));
  return current + (target - current) * factor;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToNumber(c: RGB): number {
  return (Math.round(c.r) << 16) | (Math.round(c.g) << 8) | Math.round(c.b);
}

export function approachRgb(current: RGB, target: RGB, dtMs: number, durationMs: number): RGB {
  return {
    r: approach(current.r, target.r, dtMs, durationMs),
    g: approach(current.g, target.g, dtMs, durationMs),
    b: approach(current.b, target.b, dtMs, durationMs),
  };
}

/** Sine pulse oscillating between `min` and `max` with the given period, per section 9.1. */
export function sinePulse(nowMs: number, periodMs: number, min: number, max: number): number {
  const phase = (nowMs % periodMs) / periodMs;
  const s = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0 at t=0
  return min + (max - min) * s;
}
