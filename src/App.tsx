import { useEffect } from "react";
import "./index.css";
import "./chrome/chrome.css";
import { ContextMenu } from "./chrome/ContextMenu";
import { ControlBar } from "./chrome/ControlBar";
import { Inspector } from "./chrome/Inspector";
import { Palette } from "./chrome/Palette";
import { RenameOverlay } from "./chrome/RenameOverlay";
import { demoScene } from "./dev/seedDemoScene";
import { InteractionController } from "./interactions/InteractionController";
import { installHotkeys } from "./interactions/hotkeys";
import { BurstLayer } from "./render/BurstLayer";
import { ChartsOverlayView, type ChartSample } from "./render/ChartsOverlayView";
import { ContentLayer } from "./render/ContentLayer";
import { CursorAutoHide } from "./render/CursorAutoHide";
import { ParticleLayer } from "./render/ParticleLayer";
import { PixiStage } from "./render/PixiStage";
import { rendererCell } from "./render/rendererCell";
import { RippleLayer } from "./render/RippleLayer";
import { TitleCardView } from "./render/TitleCardView";
import { simClient as sim } from "./sim/simClientSingleton";
import { useSceneStore } from "./store/sceneStore";
import { useUiStore } from "./store/uiStore";

export function App() {
  const recording = useUiStore((s) => s.recording);

  useEffect(() => installHotkeys(), []);

  return (
    <>
      <PixiStage
        onReady={(renderer) => {
          rendererCell.current = renderer;

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
          const ripples = new RippleLayer(renderer.layers.ripples);
          new InteractionController(renderer, content, ripples);

          const titleCard = new TitleCardView();
          renderer.layers.titleCard.addChild(titleCard.container);
          const charts = new ChartsOverlayView();
          renderer.layers.charts.addChild(charts.container);
          const cursorAutoHide = new CursorAutoHide(renderer.app.canvas as HTMLCanvasElement);
          const chartSamples: ChartSample[] = [];
          let lastSampleMs = 0;

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
            ripples.tick(nowMs);
            cursorAutoHide.tick(nowMs, ui.recording);
            renderer.setEditMode(!ui.recording);

            titleCard.update(doc.title, doc.subtitle);
            charts.container.visible = doc.showChartsOverlay;
            if (doc.showChartsOverlay && nowMs - lastSampleMs > 250) {
              lastSampleMs = nowMs;
              const g = sim.getGlobalMetrics();
              chartSamples.push({ tMs: nowMs, p50: g.p50, p99: g.p99, qps: g.throughput });
              while (chartSamples.length > 0 && chartSamples[0]!.tMs < nowMs - 60_000) chartSamples.shift();
              charts.update(chartSamples, nowMs);
            }
          });
        }}
      />
      <Palette visible={!recording} />
      <ControlBar visible={!recording} />
      <Inspector visible={!recording} />
      {!recording && <ContextMenu />}
      <RenameOverlay />
    </>
  );
}
