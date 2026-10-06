import { BitmapText, Container } from "pixi.js";
import { color, type } from "../tokens";
import { makeText, setText } from "./text";

const MARGIN = 48;
const GAP = 8;

/** Scene title card (spec section 11): visible in both edit and recording mode when non-empty. */
export class TitleCardView {
  readonly container = new Container();
  private title: BitmapText;
  private subtitle: BitmapText;

  constructor() {
    this.title = makeText("", type.sceneTitle);
    this.subtitle = makeText("", { ...type.caption, color: color.textDim });
    this.container.addChild(this.title, this.subtitle);
    this.container.position.set(MARGIN, MARGIN);
  }

  update(title: string, subtitle: string): void {
    this.container.visible = title.length > 0 || subtitle.length > 0;
    setText(this.title, title);
    setText(this.subtitle, subtitle);
    this.title.position.set(0, 0);
    this.subtitle.position.set(0, this.title.height + GAP);
  }
}
