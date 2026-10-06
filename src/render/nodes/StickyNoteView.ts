import { BitmapText, Container, Graphics } from "pixi.js";
import { color, hexToNumber, type } from "../../tokens";
import { makeText, setText } from "../text";

const PADDING = 14;
const RADIUS = 8;

/** Sticky note (spec section 5.4): fixed width, height grows to fit wrapped content. */
export class StickyNoteView {
  readonly container = new Container();
  private bgGfx = new Graphics();
  private label: BitmapText;

  constructor() {
    this.label = makeText("", type.caption);
    this.container.addChild(this.bgGfx, this.label);
  }

  update(text: string, width: number): { height: number } {
    this.label.style = { ...this.label.style, wordWrap: true, wordWrapWidth: width - PADDING * 2 };
    setText(this.label, text);
    this.label.position.set(PADDING, PADDING);

    const height = Math.max(60, this.label.height + PADDING * 2);
    this.bgGfx.clear();
    this.bgGfx.roundRect(0, 0, width, height, RADIUS).fill({ color: hexToNumber(color.stateWarning), alpha: 0.14 });
    this.bgGfx.roundRect(0.5, 0.5, width - 1, height - 1, RADIUS).stroke({
      width: 1,
      color: hexToNumber(color.stateWarning),
      alpha: 0.4,
    });
    return { height };
  }
}
