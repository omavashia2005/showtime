import { BitmapText, Container, Graphics } from "pixi.js";
import { color, hexToNumber, layout, type } from "../tokens";
import { makeText, setText } from "./text";

const MARGIN = 48;
const PADDING = 14;
const CHART_W = 240;
const CHART_H = 56;
const GAP = 12;
const WINDOW_MS = 60_000;

export interface ChartSample {
  tMs: number;
  p50: number;
  p99: number;
  qps: number;
}

function sparkline(gfx: Graphics, samples: ChartSample[], nowMs: number, pick: (s: ChartSample) => number, colorHex: string): void {
  if (samples.length < 2) return;
  let min = Infinity;
  let max = -Infinity;
  for (const s of samples) {
    const v = pick(s);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max - min < 1e-6) max = min + 1;

  let started = false;
  for (const s of samples) {
    const x = ((s.tMs - (nowMs - WINDOW_MS)) / WINDOW_MS) * CHART_W;
    const y = CHART_H - ((pick(s) - min) / (max - min)) * CHART_H;
    if (!started) {
      gfx.moveTo(x, y);
      started = true;
    } else {
      gfx.lineTo(x, y);
    }
  }
  gfx.stroke({ width: 1.5, color: hexToNumber(colorHex) });
}

/** Live charts overlay (spec section 11): two stacked sparklines, no axes/gridlines/fills. */
export class ChartsOverlayView {
  readonly container = new Container();
  private bg = new Graphics();
  private latencyGfx = new Graphics();
  private throughputGfx = new Graphics();
  private p50Tag: BitmapText;
  private p50Value: BitmapText;
  private p99Tag: BitmapText;
  private p99Value: BitmapText;
  private qpsTag: BitmapText;
  private qpsValue: BitmapText;

  constructor() {
    this.p50Tag = makeText("P50", type.metaTag);
    this.p50Value = makeText("0.0 ms", type.metricValue);
    this.p99Tag = makeText("P99", { ...type.metaTag, color: color.stateWarning });
    this.p99Value = makeText("0.0 ms", type.metricValue);
    this.qpsTag = makeText("QPS", type.metaTag);
    this.qpsValue = makeText("0.0", type.metricValue);

    this.container.addChild(
      this.bg,
      this.p50Tag,
      this.p50Value,
      this.p99Tag,
      this.p99Value,
      this.latencyGfx,
      this.qpsTag,
      this.qpsValue,
      this.throughputGfx,
    );
    this.layout();
  }

  private layout(): void {
    const width = PADDING * 2 + CHART_W;
    const headerH = 20;
    const height = PADDING * 2 + headerH * 2 + CHART_H * 2 + GAP;

    this.bg.clear();
    this.bg.roundRect(0, 0, width, height, 12).fill(hexToNumber(color.bgPanel));
    this.bg.roundRect(0.5, 0.5, width - 1, height - 1, 12).stroke({ width: 1, color: hexToNumber(color.border) });

    this.p50Tag.position.set(PADDING, PADDING);
    this.p50Value.position.set(PADDING + this.p50Tag.width + 8, PADDING - 2);
    this.p99Tag.position.set(PADDING + 100, PADDING);
    this.p99Value.position.set(PADDING + 100 + this.p99Tag.width + 8, PADDING - 2);
    this.latencyGfx.position.set(PADDING, PADDING + headerH);

    const row2Y = PADDING + headerH + CHART_H + GAP;
    this.qpsTag.position.set(PADDING, row2Y);
    this.qpsValue.position.set(PADDING + this.qpsTag.width + 8, row2Y - 2);
    this.throughputGfx.position.set(PADDING, row2Y + headerH);

    this.container.position.set(layout.stageWidth - MARGIN - width, MARGIN);
  }

  update(samples: ChartSample[], nowMs: number): void {
    const latest = samples[samples.length - 1];
    setText(this.p50Value, `${(latest?.p50 ?? 0).toFixed(1)} ms`);
    setText(this.p99Value, `${(latest?.p99 ?? 0).toFixed(1)} ms`);
    setText(this.qpsValue, `${(latest?.qps ?? 0).toFixed(1)}`);
    this.p50Value.position.x = PADDING + this.p50Tag.width + 8;
    this.p99Value.position.x = PADDING + 100 + this.p99Tag.width + 8;
    this.qpsValue.position.x = PADDING + this.qpsTag.width + 8;

    const windowed = samples.filter((s) => s.tMs >= nowMs - WINDOW_MS);
    this.latencyGfx.clear();
    sparkline(this.latencyGfx, windowed, nowMs, (s) => s.p50, color.primary);
    sparkline(this.latencyGfx, windowed, nowMs, (s) => s.p99, color.stateWarning);
    this.throughputGfx.clear();
    sparkline(this.throughputGfx, windowed, nowMs, (s) => s.qps, color.stateHealthy);
  }
}
