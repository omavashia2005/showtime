import { BitmapText, Container, Graphics } from "pixi.js";
import { color, hexToNumber, layout, type } from "../tokens";
import { KEYSPACE_MAX, type KeyRange } from "../types/scene";
import { makeText, setText } from "./text";

interface KeyDot {
  frac: number;
  bornAtMs: number;
}

const APPEAR_MS = 300;
const FADE_MS = 140;
const DOT_LIFETIME_MS = APPEAR_MS + FADE_MS;

/** Keyspace bar (spec section 5.3): alternating owner ranges, boundaries, labels, and the
 * transient key-routing dot animation. */
export class KeyspaceBarView {
  readonly container = new Container();
  private bg = new Graphics();
  private rangesGfx = new Graphics();
  private dotsGfx = new Graphics();
  private labels: BitmapText[] = [];
  private dots: KeyDot[] = [];
  private width: number = layout.keyspaceBarWidth;

  constructor() {
    this.container.addChild(this.bg, this.rangesGfx, this.dotsGfx);
  }

  addKeyDot(frac: number, nowMs: number): void {
    this.dots.push({ frac, bornAtMs: nowMs });
  }

  update(ranges: KeyRange[], nameOf: (id: string) => string, width: number, hoveredRangeId: string | null): void {
    this.width = width;
    const h = layout.keyspaceBarHeight;

    this.bg.clear();
    this.bg.roundRect(0, 0, width, h, layout.keyspaceBarRadius).fill(hexToNumber(color.bgPanel));
    this.bg.roundRect(0.5, 0.5, width - 1, h - 1, layout.keyspaceBarRadius).stroke({
      width: 1,
      color: hexToNumber(color.border),
    });

    this.rangesGfx.clear();
    while (this.labels.length < ranges.length) {
      const t = makeText("", type.metaTag);
      this.labels.push(t);
      this.container.addChild(t);
    }
    while (this.labels.length > ranges.length) {
      this.labels.pop()!.destroy();
    }

    ranges.forEach((r, i) => {
      const x0 = (r.start / KEYSPACE_MAX) * width;
      const x1 = (r.end / KEYSPACE_MAX) * width;
      const rangeWidth = x1 - x0;
      const isHovered = hoveredRangeId === r.id;
      const fillHex = isHovered ? color.primary : i % 2 === 0 ? "#152B29" : "#1B3532";
      const fillAlpha = isHovered ? 0.15 : 1;
      this.rangesGfx.rect(x0, 0, rangeWidth, h).fill({ color: hexToNumber(fillHex), alpha: fillAlpha });

      if (i > 0) {
        this.rangesGfx
          .moveTo(x0, 0)
          .lineTo(x0, h)
          .stroke({ width: 1, color: hexToNumber(color.primary), alpha: 0.4 });
      }

      const label = this.labels[i]!;
      setText(label, nameOf(r.ownerNodeId), true);
      label.visible = rangeWidth >= label.width + 16;
      label.position.set(x0 + rangeWidth / 2 - label.width / 2, h / 2 - label.height / 2);
    });
  }

  tick(nowMs: number): void {
    this.dots = this.dots.filter((d) => nowMs - d.bornAtMs < DOT_LIFETIME_MS);
    this.dotsGfx.clear();
    for (const d of this.dots) {
      const age = nowMs - d.bornAtMs;
      const alpha = age <= APPEAR_MS ? 1 : 1 - (age - APPEAR_MS) / FADE_MS;
      const x = d.frac * this.width;
      this.dotsGfx.circle(x, layout.keyspaceBarHeight / 2, 1.5).fill({ color: hexToNumber(color.primary), alpha });
    }
  }
}
