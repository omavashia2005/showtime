import type { CSSProperties } from "react";
import { color } from "../tokens";

export const panelSurface: CSSProperties = {
  background: color.bgPanel,
  border: `1px solid ${color.border}`,
};

export const inputStyle: CSSProperties = {
  background: color.bgStage,
  border: `1px solid ${color.border}`,
  color: color.text,
  fontFamily: "Geist Mono, monospace",
  fontSize: 13,
};

export const chromeLabelStyle: CSSProperties = {
  fontFamily: "Inter, sans-serif",
  fontSize: 13,
  fontWeight: 500,
  color: color.textDim,
};

export const chromeValueStyle: CSSProperties = {
  fontFamily: "Geist Mono, monospace",
  fontSize: 13,
  fontWeight: 400,
  color: color.text,
};

export function iconColor(active: boolean): string {
  return active ? color.primary : color.textDim;
}
