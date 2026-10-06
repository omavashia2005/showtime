/**
 * Design tokens. Every visual value used anywhere in the app must come from here.
 * See spec section 4.
 */

export const color = {
  bgStage: "#0A1716",
  bgLetterbox: "#050B0B",
  bgPanel: "#0F1F1E",
  bgRaised: "#152B29",
  border: "#1F3B38",
  primary: "#5CC8FF",
  lineDim: "#2E6A8A",
  text: "#E6F1FA",
  textDim: "#8AA3B8",
  stateHealthy: "#3DDC97",
  stateWarning: "#FFC145",
  stateCritical: "#FF5A5F",
  stateIdle: "#5B6B7F",
  stateInfo: "#7AA2FF",
} as const;

export type ColorToken = keyof typeof color;

/** Hex "#RRGGBB" + separate alpha (0-1) since Pixi wants numeric colors + alpha separately. */
export function hexToNumber(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export const fontFamily = {
  inter: "Inter",
  geistMono: "Geist Mono",
} as const;

export const type = {
  sceneTitle: { family: fontFamily.inter, size: 40, weight: 600, letterSpacing: -0.01, color: color.text },
  nodeLabel: { family: fontFamily.inter, size: 20, weight: 500, color: color.text },
  metricValue: { family: fontFamily.geistMono, size: 18, weight: 500, color: color.text },
  metricUnit: { family: fontFamily.geistMono, size: 13, weight: 400, color: color.textDim },
  caption: { family: fontFamily.inter, size: 16, weight: 400, color: color.text },
  metaTag: { family: fontFamily.geistMono, size: 13, weight: 500, letterSpacing: 0.06, uppercase: true, color: color.textDim },
  chromeLabel: { family: fontFamily.inter, size: 13, weight: 500, color: color.textDim },
  chromeValue: { family: fontFamily.geistMono, size: 13, weight: 400, color: color.text },
} as const;

export const motion = {
  uiDurationMs: 140,
  uiEasing: "cubic-bezier(0, 0, 0.2, 1)",
  stateColorDurationMs: 160,
  nodeAppearMs: 120,
  nodeRemoveMs: 100,
  queueBarDurationMs: 140,
  criticalPulsePeriodMs: 1200,
  dropBurstMs: 280,
  rippleMs: 320,
  cursorIdleMs: 1500,
} as const;

/** Cubic bezier(0,0,0.2,1) sampled as a JS easing function for manual tweening (Pixi has no CSS easing). */
export function easeStandard(t: number): number {
  // cubic-bezier(0, 0, 0.2, 1) approximated via De Casteljau on the bezier curve's y(t) for x(t)=t solved numerically.
  // Close-enough analytic approximation: ease-out cubic matches this curve well for UI-scale durations.
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export const layout = {
  stageWidth: 1920,
  stageHeight: 1080,
  nodeWidth: 168,
  nodeHeight: 76,
  nodeRadius: 10,
  circleDiameter: 96,
  queueBarInset: 14,
  queueBarBottomOffset: 12,
  queueBarHeight: 6,
  queueBarRadius: 3,
  selectedRingWidth: 4,
  selectedRingOffset: 3,
  keyspaceBarWidth: 1200,
  keyspaceBarHeight: 28,
  keyspaceBarRadius: 6,
  stickyNoteWidth: 220,
  gridSnap: 8,
  particleDiameter: 5,
  nodePortCount: 4,
} as const;

export function queueFillColor(fillRatio: number): string {
  if (fillRatio > 0.85) return color.stateCritical;
  if (fillRatio >= 0.6) return color.stateWarning;
  return color.stateHealthy;
}
