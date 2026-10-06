import { Application, Graphics, Particle, ParticleContainer, Texture } from "pixi.js";
import type { DecodedSpawn } from "../sim/client";
import { color, hexToNumber, layout } from "../tokens";
import { cubicBezierPoint, type EdgeGeom } from "./edgeGeometry";

const MAX_PARTICLES = 4000;
const MIN_VISUAL_MS = 250;
const MAX_VISUAL_MS = 1500;

const COLOR_HEX = [color.primary, color.stateHealthy, color.stateCritical, color.stateWarning, color.stateInfo].map(
  hexToNumber,
);

interface ActiveSlot {
  index: number;
  geom: EdgeGeom;
  forward: boolean;
  fraction: number; // how far along the curve this hop travels before arriving/bursting
  outcome: 0 | 1;
  startMs: number;
  durationMs: number;
}

export type BurstSink = (x: number, y: number, nowMs: number) => void;

/** Pooled ParticleContainer rendering of request/response/error/retry/replication dots
 * (spec section 7). Position interpolation is owned here (wall-clock driven) so motion stays
 * smooth independent of worker tick timing. */
export class ParticleLayer {
  readonly particleContainer: ParticleContainer;
  private pool: Particle[] = [];
  private freeIndices: number[] = [];
  private active: ActiveSlot[] = [];

  onBurst: BurstSink = () => {};

  constructor(app: Application) {
    const dot = new Graphics().circle(0, 0, layout.particleDiameter / 2).fill(0xffffff);
    const texture: Texture = app.renderer.generateTexture(dot);
    dot.destroy();

    this.particleContainer = new ParticleContainer({
      texture,
      dynamicProperties: { position: true, color: true },
    });

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = new Particle({ texture, x: -9999, y: -9999, alpha: 0, anchorX: 0.5, anchorY: 0.5 });
      this.pool.push(p);
      this.particleContainer.addParticle(p);
      this.freeIndices.push(i);
    }
  }

  spawn(desc: DecodedSpawn, edgeLatencyMs: number, timeDilation: number, geom: EdgeGeom, nowMs: number): void {
    const index = this.freeIndices.pop();
    if (index === undefined) return; // pool exhausted; drop silently (section 7 cap)

    const fullDuration = Math.min(MAX_VISUAL_MS, Math.max(MIN_VISUAL_MS, edgeLatencyMs * timeDilation));
    const fraction = fullDuration > 0 ? Math.min(1, desc.durationMsWall / fullDuration) : 1;

    const particle = this.pool[index]!;
    particle.tint = COLOR_HEX[desc.colorId]!;
    particle.alpha = 1;

    this.active.push({
      index,
      geom,
      forward: desc.forward,
      fraction,
      outcome: desc.outcome,
      startMs: nowMs,
      durationMs: Math.max(1, desc.durationMsWall),
    });
  }

  tick(nowMs: number): void {
    if (this.active.length === 0) return;
    const stillActive: ActiveSlot[] = [];
    for (const slot of this.active) {
      const tLocal = Math.min(1, (nowMs - slot.startMs) / slot.durationMs);
      const curveT = slot.forward ? slot.fraction * tLocal : 1 - slot.fraction * tLocal;
      const pos = cubicBezierPoint(slot.geom, curveT);
      const particle = this.pool[slot.index]!;
      particle.x = pos.x;
      particle.y = pos.y;

      if (tLocal >= 1) {
        if (slot.outcome === 1) this.onBurst(pos.x, pos.y, nowMs);
        particle.alpha = 0;
        particle.x = -9999;
        this.freeIndices.push(slot.index);
      } else {
        stillActive.push(slot);
      }
    }
    this.active = stillActive;
  }
}
