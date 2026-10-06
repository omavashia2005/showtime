import { SimEngine } from "./engine";
import type { MainToWorker, SnapshotMessage } from "./protocol";
import { SPAWN_FLOATS_PER_ENTRY } from "./protocol";

const engine = new SimEngine();
let edgeOrder = new Map<string, number>();

function postSnapshot(): void {
  const { bursts, keyRouteDots, spawns } = engine.drainForSnapshot(edgeOrder);
  const buf = new ArrayBuffer(Math.max(1, spawns.length) * SPAWN_FLOATS_PER_ENTRY * 4);
  const view = new Float32Array(buf);
  spawns.forEach((s, i) => {
    const o = i * SPAWN_FLOATS_PER_ENTRY;
    view[o] = edgeOrder.get(s.edgeId) ?? -1;
    view[o + 1] = s.forward ? 1 : 0;
    view[o + 2] = s.colorId;
    view[o + 3] = s.durationMsWall;
    view[o + 4] = s.outcome;
  });

  const msg: SnapshotMessage = {
    type: "snapshot",
    simTimeMs: engine.simTime,
    spawnBuffer: buf,
    spawnCount: spawns.length,
    nodeMetrics: engine.buildNodeMetrics(),
    globalMetrics: engine.buildGlobalMetrics(),
    bursts,
    keyRouteDots,
  };
  (postMessage as (message: unknown, transfer: Transferable[]) => void)(msg, [buf]);
}

self.onmessage = (e: MessageEvent<MainToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "setScene":
      edgeOrder = new Map(msg.payload.edges.map((edge, i) => [edge.id, i]));
      engine.setScene(msg.payload);
      break;
    case "tick":
      engine.advance((msg.wallDtMs * msg.speed) / msg.timeDilation, msg.timeDilation);
      postSnapshot();
      break;
    case "step":
      engine.advance((16.667 * msg.speed) / msg.timeDilation, msg.timeDilation);
      postSnapshot();
      break;
    case "reset":
      engine.reset();
      postSnapshot();
      break;
    case "setFault":
      engine.setFault(msg.nodeId, msg.fault);
      break;
    case "setEdgeFault":
      engine.setEdgeFault(msg.edgeId, msg);
      break;
  }
};
