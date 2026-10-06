import { useEffect, useRef } from "react";
import { SceneRenderer } from "./SceneRenderer";

interface PixiStageProps {
  onReady: (renderer: SceneRenderer) => void;
}

export function PixiStage({ onReady }: PixiStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new SceneRenderer();
    let disposed = false;

    renderer.init(container).then(() => {
      if (disposed) {
        renderer.destroy();
        return;
      }
      renderer.resize(container.clientWidth, container.clientHeight);
      onReady(renderer);
    });

    const ro = new ResizeObserver(() => {
      if (!renderer.ready) return;
      renderer.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      ro.disconnect();
      // Don't destroy here: `renderer.app` is assigned synchronously at the start of
      // SceneRenderer.init(), before `app.init()` (which wires up Pixi's internal plugins)
      // has resolved. Destroying mid-init crashes inside Pixi (e.g. ResizePlugin's
      // _cancelResize isn't set up yet). The `disposed` check in the .then() above already
      // destroys safely once init has actually finished.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, overflow: "hidden" }} />;
}
