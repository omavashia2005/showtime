/**
 * Pure geometry shared between the main thread (drawing edges) and the sim worker
 * (computing particle positions along those same curves). No Pixi/DOM imports here
 * so it can run in either context.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface EdgeGeom {
  p0: Pt; // source port
  c0: Pt; // control point near source
  c1: Pt; // control point near target
  p1: Pt; // target port
}

export interface NodeBox {
  pos: Pt; // top-left
  size: Pt; // width/height (for circles, size.x === size.y === diameter)
}

function center(n: NodeBox): Pt {
  return { x: n.pos.x + n.size.x / 2, y: n.pos.y + n.size.y / 2 };
}

/** Side midpoint port facing the other node, per spec section 6. */
function portFor(n: NodeBox, other: NodeBox): { point: Pt; normal: Pt } {
  const c = center(n);
  const oc = center(other);
  const dx = oc.x - c.x;
  const dy = oc.y - c.y;
  const hw = n.size.x / 2;
  const hh = n.size.y / 2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sign = dx >= 0 ? 1 : -1;
    return { point: { x: c.x + sign * hw, y: c.y }, normal: { x: sign, y: 0 } };
  }
  const sign = dy >= 0 ? 1 : -1;
  return { point: { x: c.x, y: c.y + sign * hh }, normal: { x: 0, y: sign } };
}

export function computeEdgeGeometry(source: NodeBox, target: NodeBox): EdgeGeom {
  const a = portFor(source, target);
  const b = portFor(target, source);
  const distance = Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y);
  const extend = Math.max(60, 0.5 * distance);
  return {
    p0: a.point,
    c0: { x: a.point.x + a.normal.x * extend, y: a.point.y + a.normal.y * extend },
    c1: { x: b.point.x + b.normal.x * extend, y: b.point.y + b.normal.y * extend },
    p1: b.point,
  };
}

export function cubicBezierPoint(g: EdgeGeom, t: number): Pt {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const x = uu * u * g.p0.x + 3 * uu * t * g.c0.x + 3 * u * tt * g.c1.x + tt * t * g.p1.x;
  const y = uu * u * g.p0.y + 3 * uu * t * g.c0.y + 3 * u * tt * g.c1.y + tt * t * g.p1.y;
  return { x, y };
}

/** Flattened points for hit-testing / drawing. */
export function flattenBezier(g: EdgeGeom, segments = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push(cubicBezierPoint(g, i / segments));
  }
  return pts;
}

export function distanceToBezier(g: EdgeGeom, p: Pt, segments = 24): number {
  const pts = flattenBezier(g, segments);
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const d = distanceToSegment(p, a, b);
    if (d < min) min = d;
  }
  return min;
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}
