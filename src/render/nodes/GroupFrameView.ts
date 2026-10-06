import { BitmapText, Container, Graphics } from "pixi.js";
import { color, hexToNumber, type } from "../../tokens";
import { roundedRectPath, strokeDashedPath } from "../dashed";
import { makeText, setText } from "../text";

export interface GroupFrameUpdate {
  name: string;
  width: number;
  height: number;
}

/** Non-simulated group frame (spec section 5.4): dashed outline, no fill. */
export class GroupFrameView {
  readonly container = new Container();
  private strokeGfx = new Graphics();
  private label: BitmapText;

  constructor() {
    this.label = makeText("", type.metaTag);
    this.container.addChild(this.strokeGfx, this.label);
  }

  update(u: GroupFrameUpdate): void {
    setText(this.label, u.name, true);
    this.label.position.set(12, 12);

    this.strokeGfx.clear();
    const path = roundedRectPath(0.5, 0.5, u.width - 1, u.height - 1, 16);
    strokeDashedPath(this.strokeGfx, path, 4, 4, { width: 1, color: hexToNumber(color.lineDim) });
  }
}
