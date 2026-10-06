import { useRef } from "react";
import "./index.css";
import "./chrome/chrome.css";
import { ContextMenu } from "./chrome/ContextMenu";
import { ControlBar } from "./chrome/ControlBar";
import { Inspector } from "./chrome/Inspector";
import { Palette } from "./chrome/Palette";
import { demoScene } from "./dev/seedDemoScene";
import { BurstLayer } from "./render/BurstLayer";
import { ContentLayer } from "./render/ContentLayer";
import { ParticleLayer } from "./render/ParticleLayer";
import { PixiStage } from "./render/PixiStage";
import type { SceneRenderer } from "./render/SceneRenderer";
import { simClient as sim } from "./sim/simClientSingleton";
import { useSceneStore } from "./store/sceneStore";
import { useUiStore } from "./store/uiStore";

export function App() {
  const rendererRef = useRef<SceneRenderer | null>(null);
  const recording = useUiStore((s) => s.recording);

  return (
    <>
      <PixiStage
        onReady={(renderer) => {
        rendererRef.current = renderer;

        const content = new ContentLayer(
          renderer.layers.nodes,
          renderer.layers.groupFrames,
          renderer.layers.annotations,
          renderer.layers.edges,
          renderer.layers.keyspaceBars,
        );
        const particles = new ParticleLayer(renderer.app);
        renderer.layers.particles.addChild(particles.particleContainer);
        const bursts = new BurstLayer(renderer.layers.bursts);

        content.getMetrics = (id) => sim.getNodeMetrics(id);

        sim.onSpawns = (spawns) => {
          const nowMs = performance.now();
          for (const s of spawns) {
            const geom = content.getEdgeGeom(s.edgeId);
            const latencyMs = content.getEdgeLatencyMs(s.edgeId);
            if (!geom || latencyMs === undefined) continue;
            content.markEdgeActive(s.edgeId, nowMs);
            particles.spawn(s, latencyMs, useSceneStore.getState().doc.timeDilation, geom, nowMs);
          }
        };
        sim.onBursts = (events) => {
          const nowMs = performance.now();
          for (const b of events) bursts.trigger(b.x, b.y, nowMs);
        };
        sim.onKeyRouteDots = (dots) => {
          const nowMs = performance.now();
          for (const d of dots) content.spawnKeyRouteDot(d.barId, d.frac, nowMs);
        };
        particles.onBurst = (x, y, nowMs) => bursts.trigger(x, y, nowMs);

        if (import.meta.env.DEV) {
          useSceneStore.getState().replaceDoc(demoScene());
        }

        content.setDoc(useSceneStore.getState().doc);
        sim.setScene(useSceneStore.getState().doc);
        useSceneStore.subscribe((state) => {
          content.setDoc(state.doc);
          sim.setScene(state.doc);
        });

        const syncSelection = () => {
          const ui = useUiStore.getState();
          content.setSelection(ui.selection, ui.hovered);
        };
        syncSelection();
        useUiStore.subscribe(syncSelection);

        renderer.app.ticker.add((ticker) => {
          const nowMs = performance.now();
          const ui = useUiStore.getState();
          const doc = useSceneStore.getState().doc;
          if (!ui.paused) sim.tick(ticker.deltaMS, doc.speed, doc.timeDilation);
          content.tick(ticker.deltaMS, nowMs);
          particles.tick(nowMs);
          bursts.tick(nowMs);
        });
        }}
      />
      <Palette visible={!recording} />
      <ControlBar visible={!recording} />
      <Inspector visible={!recording} />
      {!recording && <ContextMenu />}
    </>
  );
}
