import { useRef } from "react";
import "./index.css";
import { PixiStage } from "./render/PixiStage";
import type { SceneRenderer } from "./render/SceneRenderer";

export function App() {
  const rendererRef = useRef<SceneRenderer | null>(null);

  return (
    <PixiStage
      onReady={(renderer) => {
        rendererRef.current = renderer;
      }}
    />
  );
}
