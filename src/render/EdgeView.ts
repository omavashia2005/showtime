import { Container, Graphics } from "pixi.js";
import { color, hexToNumber } from "../tokens";
import { approachRgb, hexToRgb, rgbToNumber } from "./anim";
import { strokeDashedPath } from "./dashed";
import { distanceToBezier, flattenBezier, splitBezierAtMidGap, type EdgeGeom, type Pt } from "./edgeGeometry";

export interface EdgeUpdate {
  geom: EdgeGeom;
  partitioned: boolean;
  selected: boolean;
  active: boolean;
}

const GAP_LEN = 14;

/** Edge rendering (spec section 6 + 9.3 partition visual). */
export class EdgeView {
  readonly container = new Container();
  private strokeGfx = new Graphics();
  private strokeColor = hexToRgb(color.lineDim);
  private lastGeom: EdgeGeom | null = null;

  constructor() {
    this.container.addChild(this.strokeGfx);
  }

  update(u: EdgeUpdate, dtMs: number): void {
    this.lastGeom = u.geom;
    this.strokeGfx.clear();

    if (u.partitioned) {
      this.drawPartitioned(u.geom);
      return;
    }

    const target = u.selected ? color.primary : u.active ? color.primary : color.lineDim;
    this.strokeColor = approachRgb(this.strokeColor, hexToRgb(target), dtMs, 160);
    const width = u.selected ? 2 : 1.25;
    const pts = flattenBezier(u.geom, 24);
    this.strokeGfx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) this.strokeGfx.lineTo(pts[i]!.x, pts[i]!.y);
    this.strokeGfx.stroke({ width, color: rgbToNumber(this.strokeColor) });
  }

  private drawPartitioned(geom: EdgeGeom): void {
    const { before, after, center } = splitBezierAtMidGap(geom, GAP_LEN);
    const critical = hexToNumber(color.stateCritical);
    strokeDashedPath(this.strokeGfx, before, 6, 4, { width: 1.25, color: critical });
    strokeDashedPath(this.strokeGfx, after, 6, 4, { width: 1.25, color: critical });
    this.drawXMark(center, critical);
  }

  private drawXMark(center: Pt, colorHex: number): void {
    const half = 4; // two 8px lines
    this.strokeGfx
      .moveTo(center.x - half, center.y - half)
      .lineTo(center.x + half, center.y + half)
      .moveTo(center.x - half, center.y + half)
      .lineTo(center.x + half, center.y - half)
      .stroke({ width: 1.5, color: colorHex });
  }

  hitTest(p: Pt, thresholdPx = 10): boolean {
    if (!this.lastGeom) return false;
    return distanceToBezier(this.lastGeom, p) <= thresholdPx;
  }
}
