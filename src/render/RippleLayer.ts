import { Container, Graphics } from "pixi.js";
import { color, easeStandard, hexToNumber } from "../tokens";

const DURATION_MS = 320;
const MAX_RADIUS = 28;
const POOL_SIZE = 16;

interface ActiveRipple {
  gfx: Graphics;
  x: number;
  y: number;
  startMs: number;
}

/** Click ripple (spec section 11): ring 0 -> 28px over 320ms, opacity 0.9 -> 0, drawn in the
 * stage layer so it shows up in recordings and in edit mode. */
export class RippleLayer {
  private pool: Graphics[] = [];
  private free: Graphics[] = [];
  private active: ActiveRipple[] = [];

  constructor(container: Container) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const g = new Graphics();
      g.visible = false;
      this.pool.push(g);
      this.free.push(g);
      container.addChild(g);
    }
  }

  trigger(x: number, y: number, nowMs: number): void {
    const gfx = this.free.pop();
    if (!gfx) return;
    gfx.visible = true;
    this.active.push({ gfx, x, y, startMs: nowMs });
  }

  tick(nowMs: number): void {
    if (this.active.length === 0) return;
    const stillActive: ActiveRipple[] = [];
    for (const r of this.active) {
      const t = Math.min(1, (nowMs - r.startMs) / DURATION_MS);
      const e = easeStandard(t);
      const radius = e * MAX_RADIUS;
      const alpha = 0.9 * (1 - t);
      r.gfx.clear();
      r.gfx.circle(r.x, r.y, Math.max(0.01, radius)).stroke({ width: 1.5, color: hexToNumber(color.primary), alpha });
      if (t >= 1) {
        r.gfx.visible = false;
        this.free.push(r.gfx);
      } else {
        stillActive.push(r);
      }
    }
    this.active = stillActive;
  }
}
