import { BitmapText, Container, Graphics } from "pixi.js";
import type { NodeMetricsSnapshot } from "../../sim/protocol";
import { color, hexToNumber, layout, queueFillColor, type } from "../../tokens";
import type { FaultState, NodeKind } from "../../types/scene";
import { approach, approachRgb, easeBackOut, hexToRgb, rgbToNumber, sinePulse } from "../anim";
import { makeText, setText } from "../text";
import { computeRimTarget, typeTagFor } from "./nodeVisual";

const APPEAR_POP_MS = 220;
const SELECT_POP_MS = 220;

export interface RectNodeUpdate {
  name: string;
  kind: NodeKind;
  width: number;
  height: number;
  fault: FaultState;
  metrics: NodeMetricsSnapshot | null;
  hovered: boolean;
  selected: boolean;
  isLeader: boolean;
}

/** Shared box styling for Client/Router/Shard/Partition/Box nodes (spec section 5.1). */
export class RectNodeView {
  readonly container = new Container();

  private fillGfx = new Graphics();
  private strokeGfx = new Graphics();
  private selectionRingGfx = new Graphics();
  private queueTrackGfx = new Graphics();
  private queueFillGfx = new Graphics();
  private label: BitmapText;
  private tag: BitmapText;
  private leaderTagBg = new Graphics();

  private strokeColor = hexToRgb(color.primary);
  private strokeAlpha = 0.7;
  private queueWidthPx = 0;
  private queueColor = hexToRgb(color.stateHealthy);

  private width: number = layout.nodeWidth;
  private height: number = layout.nodeHeight;
  private lastTagText: string | null = null;

  private createdAtMs = performance.now();
  private wasSelected = false;
  private selectedSinceMs = 0;

  constructor() {
    this.label = makeText("", type.nodeLabel);
    this.tag = makeText("", type.metaTag);

    this.container.addChild(this.fillGfx, this.strokeGfx, this.queueTrackGfx, this.queueFillGfx);
    this.container.addChild(this.label, this.leaderTagBg, this.tag);
    this.container.addChild(this.selectionRingGfx);
  }

  update(u: RectNodeUpdate, dtMs: number, nowMs: number): void {
    this.width = u.width;
    this.height = u.height;

    if (u.selected && !this.wasSelected) this.selectedSinceMs = nowMs;
    this.wasSelected = u.selected;

    this.container.pivot.set(this.width / 2, this.height / 2);
    const appearT = Math.min(1, (nowMs - this.createdAtMs) / APPEAR_POP_MS);
    this.container.scale.set(easeBackOut(appearT));
    const fadeIn = Math.min(1, (nowMs - this.createdAtMs) / 120);

    setText(this.label, u.name);
    this.label.position.set(14, 14);

    const queueVisible = u.kind !== "client";
    this.queueTrackGfx.visible = queueVisible;
    this.queueFillGfx.visible = queueVisible;

    if (u.fault.killed) {
      this.setTagPlain("DOWN", color.stateCritical);
    } else if (u.isLeader) {
      this.setTagLeader();
    } else {
      const tagText = typeTagFor(u.kind);
      if (tagText) this.setTagPlain(tagText, color.textDim);
      else {
        this.tag.visible = false;
        this.leaderTagBg.visible = false;
      }
    }

    this.container.alpha = (u.fault.killed ? 0.35 : 1) * fadeIn;

    const rim = computeRimTarget(u.fault, u.metrics?.health ?? null, u.hovered, u.selected);
    const targetAlpha = rim.pulsing ? sinePulse(nowMs, 1200, 0.45, 1) : rim.alpha;
    this.strokeColor = approachRgb(this.strokeColor, hexToRgb(rim.colorHex), dtMs, 160);
    this.strokeAlpha = approach(this.strokeAlpha, targetAlpha, dtMs, 160);

    const ratio = u.metrics && u.metrics.queueCap > 0 ? u.metrics.queueLen / u.metrics.queueCap : 0;
    const targetWidth = Math.max(0, Math.min(1, ratio)) * (this.width - layout.queueBarInset * 2);
    this.queueWidthPx = approach(this.queueWidthPx, targetWidth, dtMs, 140);
    this.queueColor = approachRgb(this.queueColor, hexToRgb(queueFillColor(ratio)), dtMs, 160);

    this.redrawFill();
    this.redrawStroke(rim.width);
    this.redrawQueue();
    this.selectionRingGfx.visible = u.selected;
    if (u.selected) {
      const popT = Math.min(1, (nowMs - this.selectedSinceMs) / SELECT_POP_MS);
      this.selectionRingGfx.pivot.set(this.width / 2, this.height / 2);
      this.selectionRingGfx.position.set(this.width / 2, this.height / 2);
      this.selectionRingGfx.scale.set(easeBackOut(popT));
      this.redrawSelectionRing();
    }

    this.tag.position.set(this.width - 14 - this.tag.width, 14);
    this.leaderTagBg.position.set(this.width - 14 - this.tag.width - 6, 11);
  }

  private setTagPlain(text: string, hex: string): void {
    this.leaderTagBg.visible = false;
    this.tag.visible = true;
    if (this.lastTagText !== text) {
      setText(this.tag, text, true);
      this.lastTagText = text;
    }
    this.tag.tint = hexToNumber(hex);
  }

  private setTagLeader(): void {
    this.tag.visible = true;
    this.leaderTagBg.visible = true;
    if (this.lastTagText !== "LEADER") {
      setText(this.tag, "LEADER", true);
      this.lastTagText = "LEADER";
    }
    this.tag.tint = hexToNumber(color.bgStage);
    const w = this.tag.width + 12;
    const h = this.tag.height + 6;
    this.leaderTagBg.clear();
    this.leaderTagBg.roundRect(0, 0, w, h, 4).fill(hexToNumber(color.primary));
  }

  private redrawFill(): void {
    this.fillGfx.clear();
    this.fillGfx.roundRect(0, 0, this.width, this.height, layout.nodeRadius).fill(hexToNumber(color.bgRaised));
  }

  private redrawStroke(width: number): void {
    this.strokeGfx.clear();
    this.strokeGfx.roundRect(0, 0, this.width, this.height, layout.nodeRadius).stroke({
      width,
      color: rgbToNumber(this.strokeColor),
      alpha: this.strokeAlpha,
      alignment: 0.5,
    });
  }

  private redrawQueue(): void {
    const trackW = this.width - layout.queueBarInset * 2;
    const y = this.height - layout.queueBarBottomOffset - layout.queueBarHeight;
    this.queueTrackGfx.clear();
    this.queueTrackGfx
      .roundRect(layout.queueBarInset, y, trackW, layout.queueBarHeight, layout.queueBarRadius)
      .fill(hexToNumber(color.bgStage));

    this.queueFillGfx.clear();
    if (this.queueWidthPx > 0.5) {
      this.queueFillGfx
        .roundRect(layout.queueBarInset, y, this.queueWidthPx, layout.queueBarHeight, layout.queueBarRadius)
        .fill(rgbToNumber(this.queueColor));
    }
  }

  private redrawSelectionRing(): void {
    const o = layout.selectedRingOffset;
    this.selectionRingGfx.clear();
    this.selectionRingGfx
      .roundRect(-o, -o, this.width + o * 2, this.height + o * 2, layout.nodeRadius + o)
      .stroke({ width: layout.selectedRingWidth, color: hexToNumber(color.primary), alpha: 0.2, alignment: 0.5 });
  }
}
