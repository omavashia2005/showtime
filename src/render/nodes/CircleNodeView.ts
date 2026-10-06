import { BitmapText, Container, Graphics } from "pixi.js";
import type { NodeMetricsSnapshot } from "../../sim/protocol";
import { color, hexToNumber, layout, queueFillColor, type } from "../../tokens";
import type { FaultState } from "../../types/scene";
import { approach, approachRgb, easeBackOut, hexToRgb, rgbToNumber, sinePulse } from "../anim";
import { makeText, setText } from "../text";
import { computeRimTarget } from "./nodeVisual";

const APPEAR_POP_MS = 220;
const SELECT_POP_MS = 220;

export interface CircleNodeUpdate {
  name: string;
  fault: FaultState;
  metrics: NodeMetricsSnapshot | null;
  hovered: boolean;
  selected: boolean;
}

/** Circle primitive (spec section 5.4): queue shown as a 3px arc inside the stroke. */
export class CircleNodeView {
  readonly container = new Container();

  private fillGfx = new Graphics();
  private strokeGfx = new Graphics();
  private arcGfx = new Graphics();
  private selectionRingGfx = new Graphics();
  private label: BitmapText;

  private strokeColor = hexToRgb(color.primary);
  private strokeAlpha = 0.7;
  private arcFraction = 0;
  private arcColor = hexToRgb(color.stateHealthy);

  private readonly r = layout.circleDiameter / 2;

  private createdAtMs = performance.now();
  private wasSelected = false;
  private selectedSinceMs = 0;

  constructor() {
    this.label = makeText("", type.nodeLabel);
    this.container.addChild(this.fillGfx, this.strokeGfx, this.arcGfx, this.selectionRingGfx, this.label);
    this.container.pivot.set(this.r, this.r);
  }

  update(u: CircleNodeUpdate, dtMs: number, nowMs: number): void {
    if (u.selected && !this.wasSelected) this.selectedSinceMs = nowMs;
    this.wasSelected = u.selected;

    const appearT = Math.min(1, (nowMs - this.createdAtMs) / APPEAR_POP_MS);
    this.container.scale.set(easeBackOut(appearT));
    const fadeIn = Math.min(1, (nowMs - this.createdAtMs) / 120);

    setText(this.label, u.name);
    this.label.position.set(this.r - this.label.width / 2, layout.circleDiameter + 8);

    this.container.alpha = (u.fault.killed ? 0.35 : 1) * fadeIn;

    const rim = computeRimTarget(u.fault, u.metrics?.health ?? null, u.hovered, u.selected);
    const targetAlpha = rim.pulsing ? sinePulse(nowMs, 1200, 0.45, 1) : rim.alpha;
    this.strokeColor = approachRgb(this.strokeColor, hexToRgb(rim.colorHex), dtMs, 160);
    this.strokeAlpha = approach(this.strokeAlpha, targetAlpha, dtMs, 160);

    const ratio = u.metrics && u.metrics.queueCap > 0 ? u.metrics.queueLen / u.metrics.queueCap : 0;
    this.arcFraction = approach(this.arcFraction, Math.max(0, Math.min(1, ratio)), dtMs, 140);
    this.arcColor = approachRgb(this.arcColor, hexToRgb(queueFillColor(ratio)), dtMs, 160);

    this.redrawFill();
    this.redrawStroke(rim.width);
    this.redrawArc();
    this.selectionRingGfx.visible = u.selected;
    if (u.selected) {
      const popT = Math.min(1, (nowMs - this.selectedSinceMs) / SELECT_POP_MS);
      this.selectionRingGfx.pivot.set(this.r, this.r);
      this.selectionRingGfx.position.set(this.r, this.r);
      this.selectionRingGfx.scale.set(easeBackOut(popT));
      this.redrawSelectionRing();
    }
  }

  private redrawFill(): void {
    this.fillGfx.clear();
    this.fillGfx.circle(this.r, this.r, this.r).fill(hexToNumber(color.bgRaised));
  }

  private redrawStroke(width: number): void {
    this.strokeGfx.clear();
    this.strokeGfx
      .circle(this.r, this.r, this.r)
      .stroke({ width, color: rgbToNumber(this.strokeColor), alpha: this.strokeAlpha, alignment: 0.5 });
  }

  private redrawArc(): void {
    this.arcGfx.clear();
    if (this.arcFraction <= 0.001) return;
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * this.arcFraction;
    const arcR = this.r - 3;
    this.arcGfx.arc(this.r, this.r, arcR, start, end).stroke({
      width: 3,
      color: rgbToNumber(this.arcColor),
      alignment: 0.5,
      cap: "butt",
    });
  }

  private redrawSelectionRing(): void {
    const o = layout.selectedRingOffset;
    this.selectionRingGfx.clear();
    this.selectionRingGfx
      .circle(this.r, this.r, this.r + o)
      .stroke({ width: layout.selectedRingWidth, color: hexToNumber(color.primary), alpha: 0.2, alignment: 0.5 });
  }
}
