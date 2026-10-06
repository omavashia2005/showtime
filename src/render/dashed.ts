import type { Graphics } from "pixi.js";
import type { Pt } from "./edgeGeometry";

/** Flattened polyline for a rounded rect, used as a path to stroke dashed (Pixi v8 Graphics
 * has no native dash pattern). */
export function roundedRectPath(x: number, y: number, w: number, h: number, r: number, cornerSegs = 8): Pt[] {
  const pts: Pt[] = [];
  const corners: { cx: number; cy: number; startAngle: number }[] = [
    { cx: x + w - r, cy: y + r, startAngle: -Math.PI / 2 }, // top-right
    { cx: x + w - r, cy: y + h - r, startAngle: 0 }, // bottom-right
    { cx: x + r, cy: y + h - r, startAngle: Math.PI / 2 }, // bottom-left
    { cx: x + r, cy: y + r, startAngle: Math.PI }, // top-left
  ];
  for (const c of corners) {
    for (let i = 0; i <= cornerSegs; i++) {
      const a = c.startAngle + (Math.PI / 2) * (i / cornerSegs);
      pts.push({ x: c.cx + Math.cos(a) * r, y: c.cy + Math.sin(a) * r });
    }
  }
  pts.push(pts[0]!);
  return pts;
}

/** Stroke a closed polyline as dashes of `dash` on / `gap` off, in local path-length space. */
export function strokeDashedPath(
  g: Graphics,
  pts: Pt[],
  dash: number,
  gap: number,
  opts: { width: number; color: number; alpha?: number },
): void {
  let remaining = dash;
  let drawing = true;
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i]!;
    const b = pts[i + 1]!;
    let segLen = Math.hypot(b.x - a.x, b.y - a.y);
    while (segLen > 0) {
      const step = Math.min(remaining, segLen);
      const t = step / segLen;
      const next: Pt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (drawing) {
        g.moveTo(a.x, a.y).lineTo(next.x, next.y);
      }
      segLen -= step;
      remaining -= step;
      a = next;
      if (remaining <= 0.0001) {
        drawing = !drawing;
        remaining = drawing ? dash : gap;
      }
    }
  }
  g.stroke({ width: opts.width, color: opts.color, alpha: opts.alpha ?? 1 });
}
