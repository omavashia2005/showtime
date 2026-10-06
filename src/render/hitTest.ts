import type { Pt } from "./edgeGeometry";
import { layout } from "../tokens";
import type { SceneDocument } from "../types/scene";
import type { SelectionRef } from "../store/uiStore";

function inRect(p: Pt, x: number, y: number, w: number, h: number): boolean {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}

/** Topmost hit under `p` across nodes/frames/labels/notes/keyspace bars (not edges — those are
 * hit-tested separately against their bezier curve). Nodes win over frames since they're drawn
 * on top; frames only register a hit in their 12px label band so the frame's body stays
 * click-through to whatever is inside it. */
export function hitTestEntities(doc: SceneDocument, p: Pt): SelectionRef | null {
  for (const n of doc.nodes) {
    if (n.kind === "circle") {
      const r = layout.circleDiameter / 2;
      const cx = n.pos.x + r;
      const cy = n.pos.y + r;
      if (Math.hypot(p.x - cx, p.y - cy) <= r) return { kind: "node", id: n.id };
    } else if (inRect(p, n.pos.x, n.pos.y, n.size.x, n.size.y)) {
      return { kind: "node", id: n.id };
    }
  }
  for (const note of doc.notes) {
    if (inRect(p, note.pos.x, note.pos.y, note.width, 60)) return { kind: "note", id: note.id };
  }
  for (const label of doc.labels) {
    if (inRect(p, label.pos.x, label.pos.y, 200, 24)) return { kind: "label", id: label.id };
  }
  for (const bar of doc.keyspaceBars) {
    if (inRect(p, bar.pos.x, bar.pos.y, bar.width, layout.keyspaceBarHeight)) return { kind: "keyspaceBar", id: bar.id };
  }
  for (const f of doc.frames) {
    if (inRect(p, f.pos.x, f.pos.y, f.size.x, 28)) return { kind: "frame", id: f.id };
  }
  return null;
}

export function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
