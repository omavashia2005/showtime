import { BitmapText, Container } from "pixi.js";
import { type } from "../../tokens";
import { makeText, setText } from "../text";

/** Plain caption-style text label (spec section 5.4): no background. */
export class TextLabelView {
  readonly container = new Container();
  private label: BitmapText;

  constructor() {
    this.label = makeText("", type.caption);
    this.container.addChild(this.label);
  }

  update(text: string): void {
    setText(this.label, text);
  }
}
