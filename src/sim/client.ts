import type { SceneDocument, FaultState } from "../types/scene";
import { buildScenePayload } from "./buildScenePayload";
import type { BurstEvent, GlobalMetricsSnapshot, KeyRouteDotEvent, MainToWorker, NodeMetricsSnapshot, SnapshotMessage } from "./protocol";
import { SPAWN_FLOATS_PER_ENTRY } from "./protocol";

export interface DecodedSpawn {
  edgeId: string;
  forward: boolean;
  colorId: 0 | 1 | 2 | 3 | 4;
  durationMsWall: number;
  outcome: 0 | 1;
}

/**
 * Main-thread handle to the sim worker. Holds the latest snapshot in plain fields (not Zustand
 * state) so Pixi can read it every frame without going through React (section 14).
 */
export class SimClient {
  private worker: Worker;
  private edgeIdByIndex: string[] = [];

  private nodeMetrics: Record<string, NodeMetricsSnapshot> = {};
  private globalMetrics: GlobalMetricsSnapshot = { p50: 0, p99: 0, throughput: 0, errorRate: 0 };
  private simTimeMs = 0;

  onSpawns: (spawns: DecodedSpawn[]) => void = () => {};
  onBursts: (bursts: BurstEvent[]) => void = () => {};
  onKeyRouteDots: (dots: KeyRouteDotEvent[]) => void = () => {};

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<SnapshotMessage>) => this.handleSnapshot(e.data);
  }

  private handleSnapshot(msg: SnapshotMessage): void {
    this.simTimeMs = msg.simTimeMs;
    this.nodeMetrics = msg.nodeMetrics;
    this.globalMetrics = msg.globalMetrics;

    const view = new Float32Array(msg.spawnBuffer);
    const spawns: DecodedSpawn[] = [];
    for (let i = 0; i < msg.spawnCount; i++) {
      const o = i * SPAWN_FLOATS_PER_ENTRY;
      const edgeId = this.edgeIdByIndex[view[o]!];
      if (!edgeId) continue;
      spawns.push({
        edgeId,
        forward: view[o + 1] === 1,
        colorId: view[o + 2] as 0 | 1 | 2 | 3 | 4,
        durationMsWall: view[o + 3]!,
        outcome: view[o + 4] as 0 | 1,
      });
    }
    if (spawns.length) this.onSpawns(spawns);
    if (msg.bursts.length) this.onBursts(msg.bursts);
    if (msg.keyRouteDots.length) this.onKeyRouteDots(msg.keyRouteDots);
  }

  private send(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }

  setScene(doc: SceneDocument): void {
    const payload = buildScenePayload(doc);
    this.edgeIdByIndex = payload.edges.map((e) => e.id);
    this.send({ type: "setScene", payload });
  }

  tick(wallDtMs: number, speed: number, timeDilation: number): void {
    this.send({ type: "tick", wallDtMs, speed, timeDilation });
  }

  step(speed: number, timeDilation: number): void {
    this.send({ type: "step", speed, timeDilation });
  }

  reset(): void {
    this.send({ type: "reset" });
  }

  setFault(nodeId: string, fault: Partial<FaultState>): void {
    this.send({ type: "setFault", nodeId, fault });
  }

  setEdgeFault(edgeId: string, partial: { partitioned?: boolean; lossPct?: number; latencyMs?: number }): void {
    this.send({ type: "setEdgeFault", edgeId, ...partial });
  }

  getNodeMetrics(nodeId: string): NodeMetricsSnapshot | null {
    return this.nodeMetrics[nodeId] ?? null;
  }

  getGlobalMetrics(): GlobalMetricsSnapshot {
    return this.globalMetrics;
  }

  get simTime(): number {
    return this.simTimeMs;
  }

  destroy(): void {
    this.worker.terminate();
  }
}
