import { Application, Container, Graphics } from "pixi.js";
import { color, hexToNumber, layout } from "../tokens";

/**
 * Owns the Pixi Application and the fixed 1920x1080 logical stage, fit/letterboxed into
 * whatever viewport it's mounted in (spec section 3). Node/edge/particle content is added by
 * other modules onto the layer containers this exposes; this class only owns the canvas,
 * scaling, background, and border.
 */
export class SceneRenderer {
  app!: Application;

  /** Root container scaled+positioned to letterbox the 1920x1080 logical stage. */
  readonly world = new Container();

  readonly layers = {
    groupFrames: new Container(),
    edges: new Container(),
    keyspaceBars: new Container(),
    nodes: new Container(),
    annotations: new Container(),
    particles: new Container(),
    bursts: new Container(),
    overlay: new Container(), // selection rings, marquee, connect-draft line
    titleCard: new Container(),
    charts: new Container(),
    ripples: new Container(),
  };

  private letterboxBg = new Graphics();
  private stageBg = new Graphics();
  private stageBorder = new Graphics();
  private editMode = true;

  /** True only once app.init() has actually resolved — `app` itself is assigned synchronously
   * before that, so callers (e.g. the resize ResizeObserver) must check this, not `app`. */
  ready = false;

  async init(container: HTMLDivElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundAlpha: 0,
      antialias: true,
    });
    this.ready = true;
    container.appendChild(this.app.canvas);

    this.app.stage.addChild(this.letterboxBg);
    this.app.stage.addChild(this.world);

    this.world.addChild(this.stageBg);
    this.world.addChild(this.layers.groupFrames);
    this.world.addChild(this.layers.keyspaceBars);
    this.world.addChild(this.layers.edges);
    this.world.addChild(this.layers.nodes);
    this.world.addChild(this.layers.annotations);
    this.world.addChild(this.layers.particles);
    this.world.addChild(this.layers.bursts);
    this.world.addChild(this.layers.overlay);
    this.world.addChild(this.stageBorder);
    this.world.addChild(this.layers.titleCard);
    this.world.addChild(this.layers.charts);
    this.world.addChild(this.layers.ripples);

    this.drawStageBackground();
  }

  private drawStageBackground(): void {
    this.stageBg.clear();
    this.stageBg.rect(0, 0, layout.stageWidth, layout.stageHeight).fill(hexToNumber(color.bgStage));

    this.stageBorder.clear();
    this.stageBorder
      .rect(0.5, 0.5, layout.stageWidth - 1, layout.stageHeight - 1)
      .stroke({ width: 1, color: hexToNumber(color.border) });
  }

  setEditMode(editMode: boolean): void {
    this.editMode = editMode;
    this.stageBorder.visible = editMode;
  }

  resize(viewportWidth: number, viewportHeight: number): void {
    this.app.renderer.resize(viewportWidth, viewportHeight);

    this.letterboxBg.clear();
    this.letterboxBg.rect(0, 0, viewportWidth, viewportHeight).fill(hexToNumber(color.bgLetterbox));

    const scale = Math.min(viewportWidth / layout.stageWidth, viewportHeight / layout.stageHeight);
    this.world.scale.set(scale);
    this.world.position.set(
      (viewportWidth - layout.stageWidth * scale) / 2,
      (viewportHeight - layout.stageHeight * scale) / 2,
    );
  }

  /** Convert viewport (client) pixel coordinates to logical 1920x1080 stage coordinates. */
  viewportToStage(clientX: number, clientY: number, canvasRect: DOMRect): { x: number; y: number } {
    const localX = clientX - canvasRect.left;
    const localY = clientY - canvasRect.top;
    const scale = this.world.scale.x;
    return {
      x: (localX - this.world.position.x) / scale,
      y: (localY - this.world.position.y) / scale,
    };
  }

  /** Convert logical stage coordinates to viewport (client) pixel coordinates, relative to
   * the canvas's own bounding rect (add canvasRect.left/top for absolute page coordinates). */
  stageToViewport(stageX: number, stageY: number): { x: number; y: number } {
    const scale = this.world.scale.x;
    return {
      x: stageX * scale + this.world.position.x,
      y: stageY * scale + this.world.position.y,
    };
  }

  get scale(): number {
    return this.world.scale.x;
  }

  get isEditMode(): boolean {
    return this.editMode;
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
