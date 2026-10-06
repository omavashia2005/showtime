const IDLE_MS = 1500;

/** Recording-mode cursor auto-hide (spec section 11): hides after 1.5s idle, reappears on move. */
export class CursorAutoHide {
  private lastMoveMs = performance.now();
  private hidden = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointermove", this.onMove);
  }

  private onMove = (): void => {
    this.lastMoveMs = performance.now();
    if (this.hidden) {
      this.canvas.style.cursor = "";
      this.hidden = false;
    }
  };

  tick(nowMs: number, recording: boolean): void {
    if (!recording) {
      if (this.hidden) {
        this.canvas.style.cursor = "";
        this.hidden = false;
      }
      return;
    }
    if (!this.hidden && nowMs - this.lastMoveMs > IDLE_MS) {
      this.canvas.style.cursor = "none";
      this.hidden = true;
    }
  }

  destroy(): void {
    this.canvas.removeEventListener("pointermove", this.onMove);
  }
}
