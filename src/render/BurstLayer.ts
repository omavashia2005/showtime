import { Container, Graphics } from "pixi.js";
import { color, easeStandard, hexToNumber } from "../tokens";

const FRAGMENTS_PER_BURST = 4;
const POOL_SIZE = 128;
const DURATION_MS = 280;
const MIN_DIST = 10;
const MAX_DIST = 16;

interface ActiveFragment {
  gfx: Graphics;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  startMs: number;
}

/** Pooled drop-fragment bursts (spec section 9.2): 4 fragments flying outward, fading out. */
export class BurstLayer {
  private pool: Graphics[] = [];
  private free: Graphics[] = [];
  private active: ActiveFragment[] = [];

  constructor(container: Container) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const g = new Graphics().rect(-1, -1, 2, 2).fill(hexToNumber(color.stateCritical));
      g.alpha = 0;
      this.pool.push(g);
      this.free.push(g);
      container.addChild(g);
    }
  }

  trigger(x: number, y: number, nowMs: number): void {
    const baseAngle = Math.random() * Math.PI * 2;
    for (let i = 0; i < FRAGMENTS_PER_BURST; i++) {
      const gfx = this.free.pop();
      if (!gfx) return; // pool exhausted; drop silently
      const angle = baseAngle + i * (Math.PI / 2);
      const dist = MIN_DIST + Math.random() * (MAX_DIST - MIN_DIST);
      gfx.rotation = Math.random() * Math.PI * 2;
      gfx.position.set(x, y);
      gfx.alpha = 1;
      this.active.push({
        gfx,
        startX: x,
        startY: y,
        targetX: x + Math.cos(angle) * dist,
        targetY: y + Math.sin(angle) * dist,
        startMs: nowMs,
      });
    }
  }

  tick(nowMs: number): void {
    if (this.active.length === 0) return;
    const stillActive: ActiveFragment[] = [];
    for (const f of this.active) {
      const t = Math.min(1, (nowMs - f.startMs) / DURATION_MS);
      const e = easeStandard(t);
      f.gfx.position.set(f.startX + (f.targetX - f.startX) * e, f.startY + (f.targetY - f.startY) * e);
      f.gfx.alpha = 1 - t;
      if (t >= 1) {
        f.gfx.alpha = 0;
        this.free.push(f.gfx);
      } else {
        stillActive.push(f);
      }
    }
    this.active = stillActive;
  }
}
