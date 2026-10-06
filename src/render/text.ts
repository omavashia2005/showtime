import { BitmapFontManager, BitmapText, type TextStyleOptions } from "pixi.js";
import { fontFamily, hexToNumber } from "../tokens";

const installed = new Set<string>();

function install(name: string, style: TextStyleOptions): void {
  if (installed.has(name)) return;
  installed.add(name);
  BitmapFontManager.install({ name, style, resolution: 2 });
}

export interface TextSpec {
  family: string;
  size: number;
  weight: number;
  color: string;
  letterSpacing?: number;
  uppercase?: boolean;
}

function fontNameFor(spec: TextSpec): string {
  return `${spec.family}-${spec.size}-${spec.weight}-${spec.color}-${spec.letterSpacing ?? 0}`;
}

/** Create a BitmapText for a design-token text spec. Font atlas is generated once per
 * distinct (family,size,weight,color,letterSpacing) combination, per spec section 3. */
export function makeText(initialText: string, spec: TextSpec): BitmapText {
  const name = fontNameFor(spec);
  install(name, {
    fontFamily: spec.family,
    fontSize: spec.size,
    fontWeight: String(spec.weight) as TextStyleOptions["fontWeight"],
    fill: hexToNumber(spec.color),
    letterSpacing: (spec.letterSpacing ?? 0) * spec.size,
  });
  const text = spec.uppercase ? initialText.toUpperCase() : initialText;
  return new BitmapText({ text, style: { fontFamily: name, fontSize: spec.size } });
}

export function setText(bt: BitmapText, value: string, uppercase?: boolean): void {
  bt.text = uppercase ? value.toUpperCase() : value;
}

export const interFamily = fontFamily.inter;
export const geistMonoFamily = fontFamily.geistMono;
