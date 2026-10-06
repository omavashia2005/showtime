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
      if (!renderer.app) return;
      renderer.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    return () => {
      disposed = true;
      ro.disconnect();
      if (renderer.app) renderer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ position: "fixed", inset: 0, overflow: "hidden" }} />;
}
