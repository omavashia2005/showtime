import { useRef } from "react";
import "./index.css";
import { ContentLayer } from "./render/ContentLayer";
import { PixiStage } from "./render/PixiStage";
import type { SceneRenderer } from "./render/SceneRenderer";
import { useSceneStore } from "./store/sceneStore";
import { useUiStore } from "./store/uiStore";
import { demoScene } from "./dev/seedDemoScene";

export function App() {
  const rendererRef = useRef<SceneRenderer | null>(null);

  return (
    <PixiStage
      onReady={(renderer) => {
        rendererRef.current = renderer;

        const content = new ContentLayer(renderer.layers.nodes, renderer.layers.groupFrames, renderer.layers.annotations);

        if (import.meta.env.DEV) {
          useSceneStore.getState().replaceDoc(demoScene());
        }

        content.setDoc(useSceneStore.getState().doc);
        useSceneStore.subscribe((state) => content.setDoc(state.doc));

        const syncSelection = () => {
          const ui = useUiStore.getState();
          content.setSelection(ui.selection, ui.hovered);
        };
        syncSelection();
        useUiStore.subscribe(syncSelection);

        renderer.app.ticker.add((ticker) => {
          content.tick(ticker.deltaMS, performance.now());
        });
      }}
    />
  );
}
